import express from 'express'
import { EventDefinitionService } from '../services/eventDefinitionService'
import { getConnection } from '../db'

const router = express.Router()
let eventDefinitionService: EventDefinitionService

// 初始化服务
getConnection().then(conn => {
  eventDefinitionService = new EventDefinitionService(conn)
})

/**
 * 获取事件定义列表
 */
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query
    const result = await eventDefinitionService.getEventDefinitions(projectId as string)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: error.message || '获取事件定义失败' })
  }
})

/**
 * 创建事件定义
 */
router.post('/', async (req, res) => {
  try {
    const result = await eventDefinitionService.createEventDefinition(req.body)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: error.message || '创建事件定义失败' })
  }
})

/**
 * 更新事件定义
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await eventDefinitionService.updateEventDefinition(id, req.body)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: error.message || '更新事件定义失败' })
  }
})

/**
 * 删除事件定义
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { projectId } = req.query
    await eventDefinitionService.deleteEventDefinition(id, projectId as string)
    res.json({ message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || '删除事件定义失败' })
  }
})

export default router 