import swaggerJSDoc from 'swagger-jsdoc'

// Swagger/OpenAPI 配置
export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Analytics Platform API',
      version: '1.0.0',
      description: '埋点分析平台的后端 API 文档'
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Local'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  // 自动扫描路由文件中的注释生成文档
  apis: ['src/routes/api.ts']
})

