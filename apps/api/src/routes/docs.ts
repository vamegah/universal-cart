import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const swaggerUi = require('swagger-ui-express');

const router = Router();

function openApiSpecPath() {
  return path.resolve(__dirname, '../../../../docs/api/openapi.yaml');
}

/**
 * @openapi
 * /docs:
 *   get:
 *     summary: Download the generated OpenAPI 3.1 document
 *     tags: [docs]
 *     security: []
 *     responses:
 *       200:
 *         description: OpenAPI YAML document
 */
router.get('/', (_req, res) => {
  res.type('application/yaml').send(fs.readFileSync(openApiSpecPath(), 'utf8'));
});

/**
 * @openapi
 * /docs/ui:
 *   get:
 *     summary: View interactive API documentation
 *     tags: [docs]
 *     security: []
 *     responses:
 *       200:
 *         description: Swagger UI HTML
 */
const swaggerUiHandler = swaggerUi.setup(undefined, {
  explorer: true,
  swaggerOptions: {
    url: '/api/docs',
  },
  customSiteTitle: 'Universal Cart API Docs - Swagger UI',
});

router.get('/ui', swaggerUiHandler);
router.use('/ui', swaggerUi.serve, swaggerUiHandler);

export default router;
