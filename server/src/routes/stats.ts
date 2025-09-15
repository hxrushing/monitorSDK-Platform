import express from 'express'
import { StatsService } from '../services/statsService'
import { getConnection } from '../db'

const router = express.Router()
let statsService: StatsService

// 初始化服务
getConnection().then(conn => {
  statsService = new StatsService(conn)
})

/**
 * 获取统计数据
 */
router.get('/', async (req, res) => {
  try {
    const { projectId, startDate, endDate, eventName } = req.query
    const result = await statsService.getStats({
      projectId: projectId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      eventName: eventName as string
    })
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取统计数据失败' })
  }
})

export default router 