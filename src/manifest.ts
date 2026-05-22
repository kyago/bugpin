import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'QA 이슈 리포터',
  version: '0.1.0',
  description: '비개발자 QA 가 element 단위로 GitHub Issue 를 등록하는 도구',
  permissions: ['storage', 'scripting', 'tabs', 'activeTab', 'sidePanel'],
  host_permissions: ['<all_urls>'],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/panel/index.html' },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content-main/index.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    },
    {
      matches: ['<all_urls>'],
      js: ['src/content-iso/index.ts'],
      run_at: 'document_start',
    },
  ],
  action: { default_title: 'QA 이슈 리포터' },
  icons: {
    16: 'src/manifest-icons/16.png',
    48: 'src/manifest-icons/48.png',
    128: 'src/manifest-icons/128.png',
  },
});
