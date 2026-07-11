# 部署指南：GitHub Pages（替代 Vercel 的方案）

如果 Vercel 那边一直连不上，改用 GitHub Pages 部署是完全可行的，网络路径不一样，能绕开之前遇到的问题。已经帮你配好了自动部署，你只需要做这几步：

## 第一步：把这次改动推上去（如果本地项目已经改了 vite.config.js，需要重新推一次）

如果你是直接用这次给你的新 zip 包替换本地文件，操作是：
1. 解压新的 zip，把里面所有文件**覆盖**到你本地 `gmat-webapp` 文件夹（包括新增的隐藏文件夹 `.github`）
2. 在终端里：
```bash
cd gmat-webapp
git add .
git commit -m "add github pages deploy workflow"
git push
```

**注意**：`.github` 是以点开头的隐藏文件夹，Windows 资源管理器默认可能不显示。解压时确认有没有解压出这个文件夹，可以在终端里用 `dir /a` 或者 `ls -la` 确认存在。

## 第二步：在 GitHub 仓库里添加两个 Secrets（相当于 Vercel 那边的环境变量）

1. 打开你的 GitHub 仓库页面（`github.com/JolieTan/prep-tracker`）
2. 点 **Settings**（仓库自己的 Settings，不是你账号的）
3. 左侧菜单找 **Secrets and variables → Actions**
4. 点 **New repository secret**，添加两个：
   - Name: `VITE_SUPABASE_URL`　Value: 你的 Supabase Project URL
   - Name: `VITE_SUPABASE_ANON_KEY`　Value: 你的 anon key

## 第三步：开启 GitHub Pages，并把来源设为 "GitHub Actions"

1. 还是在仓库 Settings 里，左侧菜单找 **Pages**
2. 在 **Build and deployment → Source** 这里，下拉选择 **GitHub Actions**（不要选 "Deploy from a branch"）

## 第四步：触发一次部署

只要第一步的 `git push` 成功，GitHub Actions 就会自动跑起来。可以去仓库页面顶部的 **Actions** 标签页看进度，跑完之后（通常 1-2 分钟）：
- 变绿色勾 = 成功
- 变红叉 = 失败，点进去看日志报错

成功后，回到 **Settings → Pages**，页面顶部会显示你的正式网址，格式是：
```
https://JolieTan.github.io/prep-tracker/
```

## 第五步：把新网址加回 Supabase

Supabase Dashboard → **Authentication → URL Configuration**，把 `https://JolieTan.github.io/prep-tracker/` 加进 **Redirect URLs**，保存。

## 以后怎么更新网站

以后改了 `src/PrepTracker.jsx` 或其他文件，只要：
```bash
git add .
git commit -m "更新说明"
git push
```
GitHub Actions 会自动重新构建部署，不用再手动做任何事。

## 常见问题

- **页面打开是空白的**：八成是 `vite.config.js` 里的 `base` 路径和你的仓库名不一致。现在配的是 `/prep-tracker/`，如果你的仓库名不叫 `prep-tracker`，需要把 `vite.config.js` 里那一行改成 `/你的仓库名/`。
- **Actions 页面显示红叉**：点进那次运行看日志，最常见是两个 Secret 名字打错了（必须严格是 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，大小写一致）。
- **图标/样式加载不出来**：同样检查 `base` 路径是否正确。
