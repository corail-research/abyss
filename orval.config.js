const path = require('path');

const BASE_URL = process.env.VITE_ABYSS_API_URL;

module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/model_loader.ts',
      schemas: 'src/api/model',
      client: 'react-query',
      mock: true,
      baseUrl: BASE_URL,
      override: {
        mutator: {
          path: 'src/api/mutator/axios-instance.ts',
          name: 'axios_instance',
        },
      },
    },
    input: {
      target: path.resolve(__dirname, 'swagger.json'), // 
    },
  },
};
