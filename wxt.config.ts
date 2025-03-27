import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  manifest:{
    manifest_version: 3,
    name: 'EasyFill',
    version: '1.0.0',
    description: '简易填充，让每一次评论更自然，与你的博友互动无缝连接',
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png'
    },
    permissions: [
      'storage',
      'activeTab',
      'scripting'
    ],
    action: {
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/48.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png'
      },
      default_title: '简易填充'
    },
    background: {
      service_worker: 'background.js'
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content-scripts/content.js']
      }
    ],
    web_accessible_resources: [
      {
        resources: [
          'settings.html',
          'images/*'
        ],
        matches: ['<all_urls>']
      }
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    }
  }
});