"""
时序预测服务 - 使用LSTM和GRU预测PV、UV、转化率等指标
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载环境变量
load_dotenv()

app = Flask(__name__)
CORS(app)

# 尝试导入TensorFlow，如果失败则使用简化版本
try:
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, GRU, Dense, Dropout
    from tensorflow.keras.optimizers import Adam
    from sklearn.preprocessing import MinMaxScaler
    TENSORFLOW_AVAILABLE = True
    logger.info("TensorFlow已加载，将使用LSTM/GRU模型")
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logger.warning("TensorFlow未安装，将使用简化预测算法")
    from sklearn.linear_model import LinearRegression
    from sklearn.preprocessing import MinMaxScaler


class TimeSeriesPredictor:
    """时序预测器"""
    
    def __init__(self, model_type='lstm'):
        """
        初始化预测器
        Args:
            model_type: 'lstm' 或 'gru'
        """
        self.model_type = model_type
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.model = None
        self.sequence_length = 7  # 使用过去7天的数据预测
        
    def prepare_data(self, data, lookback=7):
        """
        准备训练数据
        Args:
            data: 时序数据列表
            lookback: 回看天数
        Returns:
            X, y: 特征和标签
        """
        if len(data) < lookback + 1:
            raise ValueError(f"数据量不足，至少需要 {lookback + 1} 天的数据")
        
        # 转换为numpy数组
        data = np.array(data).reshape(-1, 1)
        
        # 归一化
        scaled_data = self.scaler.fit_transform(data)
        
        X, y = [], []
        for i in range(lookback, len(scaled_data)):
            X.append(scaled_data[i-lookback:i, 0])
            y.append(scaled_data[i, 0])
        
        return np.array(X), np.array(y)
    
    def build_model(self, input_shape):
        """构建LSTM或GRU模型"""
        if not TENSORFLOW_AVAILABLE:
            # 使用线性回归作为备选
            return LinearRegression()
        
        model = Sequential()
        
        if self.model_type == 'lstm':
            model.add(LSTM(50, return_sequences=True, input_shape=(input_shape, 1)))
            model.add(Dropout(0.2))
            model.add(LSTM(50, return_sequences=False))
            model.add(Dropout(0.2))
        else:  # GRU
            model.add(GRU(50, return_sequences=True, input_shape=(input_shape, 1)))
            model.add(Dropout(0.2))
            model.add(GRU(50, return_sequences=False))
            model.add(Dropout(0.2))
        
        model.add(Dense(25))
        model.add(Dense(1))
        
        model.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
        return model
    
    def train(self, data):
        """训练模型"""
        try:
            X, y = self.prepare_data(data, self.sequence_length)
            
            if TENSORFLOW_AVAILABLE:
                # 重塑数据为LSTM/GRU需要的格式 [samples, time_steps, features]
                X = X.reshape((X.shape[0], X.shape[1], 1))
                
                # 构建并训练模型
                self.model = self.build_model(X.shape[1])
                self.model.fit(X, y, epochs=50, batch_size=32, verbose=0, validation_split=0.1)
            else:
                # 使用线性回归
                self.model = self.build_model(None)
                self.model.fit(X, y)
            
            logger.info(f"{self.model_type.upper()}模型训练完成")
            return True
        except Exception as e:
            logger.error(f"模型训练失败: {str(e)}")
            return False
    
    def predict(self, data, days=7):
        """
        预测未来N天
        Args:
            data: 历史数据列表
            days: 预测天数
        Returns:
            预测结果列表
        """
        if self.model is None:
            raise ValueError("模型未训练，请先调用train方法")
        
        # 使用最后sequence_length天的数据
        last_sequence = data[-self.sequence_length:]
        predictions = []
        
        # 归一化
        last_sequence_scaled = self.scaler.transform(np.array(last_sequence).reshape(-1, 1))
        
        current_sequence = last_sequence_scaled.copy()
        
        for _ in range(days):
            if TENSORFLOW_AVAILABLE:
                # LSTM/GRU预测
                X_input = current_sequence[-self.sequence_length:].reshape(1, self.sequence_length, 1)
                next_pred = self.model.predict(X_input, verbose=0)[0, 0]
            else:
                # 线性回归预测
                X_input = current_sequence[-self.sequence_length:].reshape(1, -1)
                next_pred = self.model.predict(X_input)[0]
            
            predictions.append(next_pred)
            
            # 更新序列（滑动窗口）
            current_sequence = np.append(current_sequence, [[next_pred]], axis=0)
        
        # 反归一化
        predictions = self.scaler.inverse_transform(np.array(predictions).reshape(-1, 1))
        predictions = [max(0, float(p[0])) for p in predictions]  # 确保非负
        
        return predictions


def calculate_conversion_rate(pv_data, uv_data):
    """计算转化率（UV/PV）"""
    if len(pv_data) != len(uv_data):
        raise ValueError("PV和UV数据长度不一致")
    
    conversion_rates = []
    for pv, uv in zip(pv_data, uv_data):
        if pv > 0:
            conversion_rates.append(uv / pv)
        else:
            conversion_rates.append(0)
    
    return conversion_rates


@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'tensorflow_available': TENSORFLOW_AVAILABLE,
        'model_types': ['lstm', 'gru']
    })


@app.route('/predict', methods=['POST'])
def predict():
    """预测接口"""
    try:
        data = request.json
        project_id = data.get('projectId')
        metric_type = data.get('metricType', 'pv')  # pv, uv, conversion_rate
        model_type = data.get('modelType', 'lstm')  # lstm, gru
        days = data.get('days', 7)
        historical_data = data.get('historicalData', [])
        
        if not historical_data:
            return jsonify({
                'success': False,
                'error': '历史数据不能为空'
            }), 400
        
        if len(historical_data) < 14:
            return jsonify({
                'success': False,
                'error': f'历史数据不足，至少需要14天，当前只有{len(historical_data)}天'
            }), 400
        
        # 提取指标数据
        if metric_type == 'conversion_rate':
            # 需要PV和UV数据来计算转化率
            pv_data = [item.get('pv', 0) for item in historical_data]
            uv_data = [item.get('uv', 0) for item in historical_data]
            metric_data = calculate_conversion_rate(pv_data, uv_data)
        else:
            metric_data = [item.get(metric_type, 0) for item in historical_data]
        
        # 创建预测器
        predictor = TimeSeriesPredictor(model_type=model_type)
        
        # 训练模型
        if not predictor.train(metric_data):
            return jsonify({
                'success': False,
                'error': '模型训练失败'
            }), 500
        
        # 进行预测
        predictions = predictor.predict(metric_data, days=days)
        
        # 生成预测日期 - 处理多种日期格式
        last_date_str = historical_data[-1]['date']
        # 尝试解析不同格式的日期
        date_formats = [
            '%Y-%m-%d',  # 标准格式
            '%Y-%m-%dT%H:%M:%S',  # ISO格式（无毫秒）
            '%Y-%m-%dT%H:%M:%S.%f',  # ISO格式（有毫秒）
            '%Y-%m-%dT%H:%M:%S.%fZ',  # ISO格式（带Z）
            '%Y-%m-%d %H:%M:%S',  # 标准日期时间格式
        ]
        
        last_date = None
        for fmt in date_formats:
            try:
                last_date = datetime.strptime(last_date_str, fmt)
                break
            except ValueError:
                continue
        
        if last_date is None:
            # 如果所有格式都失败，尝试只提取日期部分
            try:
                # 提取 YYYY-MM-DD 部分
                date_part = last_date_str.split('T')[0].split(' ')[0]
                last_date = datetime.strptime(date_part, '%Y-%m-%d')
            except:
                raise ValueError(f"无法解析日期格式: {last_date_str}")
        
        prediction_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d')
            for i in range(days)
        ]
        
        # 构建结果
        # 根据指标类型决定格式化方式：PV和UV为整数，转化率为小数
        def format_prediction_value(value, metric_type):
            if metric_type in ['pv', 'uv']:
                # PV和UV必须是整数
                return int(round(value))
            else:
                # 转化率保留4位小数
                return round(value, 4)
        
        result = {
            'success': True,
            'projectId': project_id,
            'metricType': metric_type,
            'modelType': model_type,
            'predictions': [
                {
                    'date': date,
                    'value': format_prediction_value(pred, metric_type)
                }
                for date, pred in zip(prediction_dates, predictions)
            ],
            'historicalData': historical_data[-14:],  # 返回最近14天的历史数据用于对比
            'modelInfo': {
                'tensorflowAvailable': TENSORFLOW_AVAILABLE,
                'sequenceLength': predictor.sequence_length,
                'trainingSamples': len(metric_data) - predictor.sequence_length
            }
        }
        
        logger.info(f"预测完成: {metric_type}, 模型: {model_type}, 预测天数: {days}")
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"预测失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """批量预测多个指标"""
    try:
        data = request.json
        project_id = data.get('projectId')
        metrics = data.get('metrics', ['pv', 'uv'])  # 要预测的指标列表
        model_type = data.get('modelType', 'lstm')
        days = data.get('days', 7)
        historical_data = data.get('historicalData', [])
        
        if not historical_data:
            return jsonify({
                'success': False,
                'error': '历史数据不能为空'
            }), 400
        
        results = {}
        
        for metric in metrics:
            try:
                if metric == 'conversion_rate':
                    pv_data = [item.get('pv', 0) for item in historical_data]
                    uv_data = [item.get('uv', 0) for item in historical_data]
                    metric_data = calculate_conversion_rate(pv_data, uv_data)
                else:
                    metric_data = [item.get(metric, 0) for item in historical_data]
                
                predictor = TimeSeriesPredictor(model_type=model_type)
                if predictor.train(metric_data):
                    predictions = predictor.predict(metric_data, days=days)
                    
                    # 生成预测日期 - 处理多种日期格式
                    last_date_str = historical_data[-1]['date']
                    # 尝试解析不同格式的日期
                    date_formats = [
                        '%Y-%m-%d',  # 标准格式
                        '%Y-%m-%dT%H:%M:%S',  # ISO格式（无毫秒）
                        '%Y-%m-%dT%H:%M:%S.%f',  # ISO格式（有毫秒）
                        '%Y-%m-%dT%H:%M:%S.%fZ',  # ISO格式（带Z）
                        '%Y-%m-%d %H:%M:%S',  # 标准日期时间格式
                    ]
                    
                    last_date = None
                    for fmt in date_formats:
                        try:
                            last_date = datetime.strptime(last_date_str, fmt)
                            break
                        except ValueError:
                            continue
                    
                    if last_date is None:
                        # 如果所有格式都失败，尝试只提取日期部分
                        try:
                            # 提取 YYYY-MM-DD 部分
                            date_part = last_date_str.split('T')[0].split(' ')[0]
                            last_date = datetime.strptime(date_part, '%Y-%m-%d')
                        except:
                            raise ValueError(f"无法解析日期格式: {last_date_str}")
                    
                    prediction_dates = [
                        (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d')
                        for i in range(days)
                    ]
                    
                    # 根据指标类型决定格式化方式
                    def format_batch_value(value, metric):
                        if metric in ['pv', 'uv']:
                            # PV和UV必须是整数
                            return int(round(value))
                        else:
                            # 转化率保留4位小数
                            return round(value, 4)
                    
                    results[metric] = [
                        {
                            'date': date,
                            'value': format_batch_value(pred, metric)
                        }
                        for date, pred in zip(prediction_dates, predictions)
                    ]
            except Exception as e:
                logger.error(f"预测指标 {metric} 失败: {str(e)}")
                results[metric] = None
        
        return jsonify({
            'success': True,
            'projectId': project_id,
            'modelType': model_type,
            'results': results
        })
    
    except Exception as e:
        logger.error(f"批量预测失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    import warnings
    # 隐藏Flask开发服务器的警告
    warnings.filterwarnings('ignore')
    import logging
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    
    port = int(os.getenv('ML_SERVICE_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info("=" * 50)
    logger.info("时序预测服务启动中...")
    logger.info(f"服务地址: http://localhost:{port}")
    logger.info(f"TensorFlow可用: {TENSORFLOW_AVAILABLE}")
    logger.info(f"支持模型: LSTM, GRU")
    logger.info("=" * 50)
    
    try:
        app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)
    except OSError as e:
        if "Address already in use" in str(e) or "地址已在使用" in str(e):
            logger.error(f"端口 {port} 已被占用，请检查是否有其他服务正在运行")
            logger.error("解决方案：")
            logger.error(f"1. 关闭占用端口 {port} 的其他程序")
            logger.error(f"2. 或修改 ML_SERVICE_PORT 环境变量使用其他端口")
        else:
            logger.error(f"启动失败: {e}")
        raise

