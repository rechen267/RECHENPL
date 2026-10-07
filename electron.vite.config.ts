import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { visualIds } from './scripts/visual-ids'
import { resolve } from 'node:path'
import { readFileSync, copyFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  main: {
    plugins: [{ name: 'kamucl-native-material', closeBundle() {
      execFileSync(process.execPath, [resolve(__dirname, 'scripts/build-native.cjs')], { stdio: 'inherit', windowsHide: true })
      // 内置桥接 MOD：随启动器分发，面板可一键装入实例 mods 目录（可选，无 JDK 时跳过）
      const bridgeJar = resolve(__dirname, 'bridge/dist/kamucl-bridge-1.0.1.jar')
      if (existsSync(bridgeJar)) {
        copyFileSync(bridgeJar, resolve(__dirname, 'out/main/kamucl-bridge.jar'))
      } else {
        console.warn('[kamucl] 警告：未找到 bridge/dist/kamucl-bridge-1.0.1.jar，Bridge MOD 面板将不可用（需 JDK 17+ 执行 node scripts/build-bridge.cjs）')
      }
      // 离线皮肤代理（可选，无 JDK 时跳过）
      try {
        execFileSync(process.execPath, [resolve(__dirname, 'scripts/build-offline-skin-agent.cjs')], { stdio: 'inherit', windowsHide: true })
        copyFileSync(resolve(__dirname, 'offline-skin-agent/dist/kamucl-offline-skin.jar'), resolve(__dirname, 'out/main/kamucl-offline-skin.jar'))
      } catch (e) {
        console.warn('[kamucl] 警告：离线皮肤代理构建失败（需 JDK），皮肤离线显示功能将不可用')
      }
    } }],
    build: {
      outDir: 'out/main',
      minify: true,
      sourcemap: false,
      // One graph shares projection registries/parsers across main and workers;
      // isolated CJS worker bundles used to embed the same immutable data twice.
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          modScanWorker: resolve(__dirname, 'src/main/core/modScanWorker.ts'),
          projectionWorker: resolve(__dirname, 'src/main/core/projectionWorker.ts')
        },
        output: {
          entryFileNames: chunk => chunk.name === 'index' ? 'index.js' : '[name].cjs',
          // Runtime services resolve helpers relative to __dirname. All shared
          // modules must remain beside the worker/native entry points.
          chunkFileNames: '[name]-[hash].js'
        }
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      minify: true,
      sourcemap: false,
      rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts'), splash: resolve(__dirname, 'src/preload/splash.ts') } }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html'), splash: resolve(__dirname, 'src/renderer/splash.html') } }
    },
    plugins: [visualIds(), vue()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  }
})
