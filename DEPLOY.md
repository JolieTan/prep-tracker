# 部署指南：Supabase + Vercel

这个项目结构：
```
gmat-webapp/
├── src/
│   ├── PrepTracker.jsx    ← 你的追踪工具主体，内容和之前一模一样
│   ├── App.jsx            ← 登录/登出的外壳
│   ├── storageShim.js     ← 把 window.storage 接到 Supabase 上（关键文件）
│   ├── supabaseClient.js  ← Supabase 客户端初始化
│   └── main.jsx           ← 入口
├── supabase-schema.sql    ← 建表 SQL
├── .env.example
├── package.json
└── vite.config.js
```

## 第一步：创建 Supabase 项目

1. 打开 https://supabase.com ，注册/登录，点 "New Project"。
2. 起个项目名（比如 `prep-tracker`），设置数据库密码（记下来，一般用不到但要留存），选一个离你近的区域（比如 Singapore）。
3. 项目创建好后，进入左侧 **SQL Editor**，新建一个 query，把本项目里 `supabase-schema.sql` 的内容整段粘贴进去，点 Run。
   - 这一步会建一张 `kv_store` 表，并开启 RLS（行级安全），保证每个用户只能读写自己的数据。
4. 进入左侧 **Project Settings → API**，你会看到：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` key（一长串字符）
   这两个值等下要填进环境变量。
5. （建议）进入 **Authentication → Providers**，确认 Email 登录是开启的（默认就是开的，用的是"魔法链接"免密码登录）。
   进入 **Authentication → URL Configuration**，把 `Site URL` 先填成 `http://localhost:5173`（本地开发用），部署上线后再加上你的正式网址。

## 第二步：本地跑起来试试

```bash
cd gmat-webapp
npm install
cp .env.example .env.local
```
打开 `.env.local`，把里面的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 换成你在第一步第4条拿到的真实值。

```bash
npm run dev
```
打开 http://localhost:5173 ，输入你的邮箱申请登录链接，去邮箱里点链接（会跳回 localhost），应该就能看到追踪工具了。数据这时候已经在真实存进 Supabase 数据库了。

## 第三步：推到 GitHub

```bash
cd gmat-webapp
git init
git add .
git commit -m "init prep tracker"
```
在 GitHub 建一个新仓库（不要初始化 README，避免冲突），然后：
```bash
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```
`.env.local` 已经在 `.gitignore` 里，不会被传上去，密钥是安全的。

## 第四步：部署到 Vercel

1. 打开 https://vercel.com ，用 GitHub 账号登录。
2. 点 "Add New… → Project"，选择你刚推上去的仓库，点 Import。
3. Vercel 会自动识别这是个 Vite 项目（Framework Preset 会显示 Vite），不用改构建命令。
4. 在 **Environment Variables** 里添加两个变量（跟 `.env.local` 里一样）：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 点 Deploy，等一两分钟，Vercel 会给你一个 `https://你的项目名.vercel.app` 的正式网址。

## 第五步：把正式网址加回 Supabase

回到 Supabase 的 **Authentication → URL Configuration**，把刚才 Vercel 给你的网址加进 `Redirect URLs`（比如 `https://你的项目名.vercel.app`），否则邮箱里的登录链接点了会跳转失败。

到这里就完成了：你可以在手机、电脑上用同一个邮箱登录，看到的是同一份数据，随时可以打开 Vercel 给你的网址访问。

## 之后想改界面/加功能怎么办

以后想调整功能，只需要改 `src/PrepTracker.jsx`（就是你现在这个组件本身），改完 `git add . && git commit -m "..." && git push`，Vercel 会自动重新部署，不用碰 Supabase 相关的文件。

## 常见问题

- **登录链接点了没反应 / 跳转到 localhost 404**：说明 Supabase 的 Redirect URLs 里没有加你当前访问的网址，回到第五步加一下。
- **页面提示"未登录"却没法输入邮箱**：检查 `.env.local`（本地）或 Vercel 的环境变量（线上）里两个 Supabase 变量有没有填对，填错或者漏填 `VITE_` 前缀都会导致连不上。
- **想让家人/同学也能用，但各自数据独立**：不用做任何改动，每个人用自己的邮箱登录即可，`kv_store` 表按 `user_id` 隔离，天然互不干扰。
- **想不用邮箱登录，直接开着用**：可以把 `App.jsx` 里的登录逻辑去掉，改成用一个固定的匿名 Supabase 用户，但这样部署到公网后任何人拿到网址都能看到/修改你的数据，不建议这么做。
