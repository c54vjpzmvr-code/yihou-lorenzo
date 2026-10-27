# 衣候

按当前位置天气、出门目的和自己的衣橱推荐今日穿搭。手机和电脑共用同一套页面。

## 本地运行

```sh
npm ci
npm run dev
```

未设置 Supabase 环境变量时，衣服照片存于当前浏览器的 IndexedDB，收藏存于 localStorage，仅用于本地预览。

## 开启账户同步

1. 创建一个 Supabase 项目，在 SQL Editor 运行 `supabase/schema.sql`。
2. 在项目的 Authentication 设置中启用邮箱登录；在 URL Configuration 中把公网地址设为 Site URL，并加入 Redirect URLs。项目站点地址形如 `https://<GitHub 用户名>.github.io/yihou/`。
3. 复制 `.env.example` 为 `.env.local`，填入项目 URL 和 **publishable/anon key**，不要使用 service role key。重启开发服务器后登录和云端同步会启用。
4. 登录后，可通过页面提示把这台设备以前保存在浏览器里的衣服和收藏导入账户。

每位用户的单品、收藏和私人照片由数据库及 Storage 的 RLS 策略隔离。照片不会存入 GitHub 仓库。其他设备用同一个邮箱账户登录后读取同一衣橱；页面重新获得焦点时会刷新数据。

## 公网发布

当前仓库只保存应用源码和配置示例。部署到 Vercel、GitHub Pages 或其他平台时，需要在平台的环境变量中设置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`；不要上传 `.env.local`。浏览器定位要求 HTTPS 和位置权限。
