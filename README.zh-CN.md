# 🎨 dsh-genui-charts

[English](./README.md) · **简体中文**

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）插件：模型通过 ` ```dsh-ui ` 围栏在**回答里内联渲染**交互式 UI 组件。本仓库是 [`omdsh-dev/dsh-genui`](https://github.com/omdsh-dev/dsh-genui) 的 fork，在其词汇表里融合了两个图表节点：**ECharts**（原生 option）和 **Flint**（声明式 `ChartAssemblyInput`，前端编译为 ECharts）。

<p align="center">
  <a href="https://github.com/dofine/dsh-genui-charts/blob/main/assets/demo-flint-echarts.mp4">
    <img src="./assets/demo-flint-echarts-poster.jpg" width="92%" alt="ECharts + Flint 图表演示">
  </a>
  <br>
  <em>▶ 点击图片播放演示 —— 同一份数据只改 Flint 的 <code>chartType</code> 就重渲染为柱状 / 折线 / 饼图，悬浮 tooltip 约束在图表框内。<a href="https://github.com/dofine/dsh-genui-charts/raw/main/assets/demo-flint-echarts.mp4">下载 mp4</a></em>
</p>

## 相比上游新增了什么

在上游组件集（卡片、表格、表单、标签页、mermaid、3D 场景、测验等）之上，本 fork 新增两个图表节点：

- **`echarts`** — `{"type":"echarts","option":{...},"height":n?}` 渲染任意 ECharts 图（柱 / 折线 / 饼 / 散点 / 热力 / 桑基…），带悬浮 tooltip 与缩放交互。`option` 经深度净化：函数型 `formatter` / `renderItem` 字段被剥离，任何脚本都不会进入 DOM。tooltip 约束在图表框内、坐标轴标签始终留在网格边距内、窄容器下饼图自动切换紧凑布局。
- **`flint`** — `{"type":"flint","input":{...},"height":n?}` 承载声明式 Flint `ChartAssemblyInput`（`chartType` + `encodings` + `semantic_types` + 绑定 `data.values`），前端经 `flint-chart/echarts` 编译为 ECharts option。语义类型（Amount / Percentage / Month / Category…）自动决定零基线、坐标轴格式化与百分比标签——同一份输入把 `chartType` 改一个字就换成另一种图。

引擎以按需懒加载资产（`lib/assets/echarts.js`、`lib/assets/flint.js`）随插件自有 HTTP 路由下发：核心 client bundle 保持轻量，不用图表的会话从不下载它们。

## 安装

前置：`dsh` 与 `pnpm` 在 PATH 上。

```sh
git clone <本仓库> && cd dsh-genui-charts
pnpm install
pnpm build          # lib/ 是构建产物，不提交进仓库
dsh plugin --profile web add link:$PWD
```

然后重启 `dsh web`，浏览器硬刷新（Cmd+Shift+R）。

## 使用

让模型画图，它会在回答里输出 ` ```dsh-ui ` 围栏，浏览器端就地渲染：

````markdown
```dsh-ui
{"type":"flint","input":{
  "data":{"values":[{"month":"1月","sales":128400},{"month":"2月","sales":96000}]},
  "semantic_types":{"month":"Month","sales":"Amount"},
  "chart_spec":{"chartType":"Bar Chart","encodings":{"x":{"field":"month"},"y":{"field":"sales"}}}
}}
```
````

完整节点词汇与语法见 [SKILL.md](./SKILL.md)。未安装本插件时，围栏只是普通代码块——无报错、不污染会话。

## 开发

```sh
pnpm install
pnpm run check     # 类型检查 + 测试 + 构建
```

## Credit

本仓库 fork 自 [`omdsh-dev/dsh-genui`](https://github.com/omdsh-dev/dsh-genui)（MIT）。原有组件集、双渲染通道与打包归功于上游作者；本 fork 在其上新增了上述 ECharts 与 Flint 图表节点。

## License

[MIT](./LICENSE)，继承自上游。
