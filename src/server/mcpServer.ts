import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { type MCPFunctions, mcpFunctions } from '../mcp/mcpService'

const router = express.Router()

router.use(cors())
router.use(express.json())

router.get('/functions', (_, res) => {
  const functionsList = (
    Object.keys(mcpFunctions) as (keyof MCPFunctions)[]
  ).map((functionName) => ({
    name: functionName,
    description: mcpFunctions[functionName].description,
    parameters: mcpFunctions[functionName].parameters,
  }))

  res.json(functionsList)
})

router.post(
  '/execute',
  async (
    req: Request<{}, {}, { functionName: keyof MCPFunctions; parameters: any }>,
    res: Response,
  ) => {
    const body = req.body
    const { functionName } = body
    if (!functionName) {
      res.status(400).json({ error: 'Function name is required' })
      return
    }

    if (!mcpFunctions[functionName]) {
      res.status(404).json({ error: 'Function not found' })
      return
    }

    let result: any
    try {
      switch (functionName) {
        case 'getSaoPauloDate':
          result = mcpFunctions[functionName].function()
          break
        default:
          res.status(404).json({ error: 'Function not found' })
          return
      }

      res.json(result)
      return
    } catch (error) {
      console.error('Error executing function:', error)
      res.status(500).json({ error: 'Internal server error' })
      return
    }
  },
)

export default router
