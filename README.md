# Neon Ultimate Tic-Tac-Toe

Игра на React + Vite. Онлайн-комнаты обслуживаются **Cloudflare Workers + Durable Objects**; фронтенд можно размещать на GitHub Pages. Firebase и PeerJS не используются.

## Что есть

- Ultimate Tic-Tac-Toe: локальная игра, игра против бота и онлайн-матчи 1 на 1
- Комнаты по шестизначному коду и ссылке
- Неоновый интерфейс, светлая/тёмная тема, звук, сохранение игры с ботом
- Онлайн-сообщения пересылаются через WebSocket внутри Durable Object отдельной комнаты

## 1. Развернуть Cloudflare Worker

Worker уже создан в Cloudflare с именем `ultimate-tic-tac-toe`. Конфигурация `wrangler.jsonc` в корне проекта использует это же имя и создаёт SQLite-backed Durable Object `Room`.

Требуется Node.js 20 или новее. В терминале, из корневой папки проекта, выполните:

```bash
npm install
npx wrangler login
npx wrangler deploy
```

При `wrangler login` откроется страница Cloudflare для авторизации. Подтвердите доступ к своему аккаунту. API-токен вручную создавать и кому-либо отправлять не нужно.

После публикации проверьте адрес:

`https://ultimate-tic-tac-toe.daniil2007xboctob.workers.dev/`

Он должен вернуть короткий JSON с названием backend. Адрес Worker уже прописан в `src/lib/cloudflareConfig.js`. Если имя Worker или поддомен аккаунта изменятся, обновите `WORKER_URL` в этом файле перед сборкой фронтенда.

## 2. Опубликовать игру на GitHub Pages

```bash
npm run build
```

Затем опубликуйте содержимое папки `dist/` на GitHub Pages. Если репозиторий открывается по адресу `username.github.io/repository/`, настройте `base` в `vite.config.js` на `'/repository/'`. Для сайта в корне домена оставьте `base: './'`.

## 3. Проверка онлайн-игры

1. Откройте опубликованную игру в двух разных браузерах или на двух устройствах.
2. На первом устройстве нажмите «По сети» → «Создать комнату».
3. На втором введите показанный код или откройте ссылку комнаты.
4. Сделайте несколько ходов в обе стороны и проверьте синхронизацию.

Комната рассчитана максимум на двух игроков. Когда один игрок отключается, второй получает уведомление. Данные партий не сохраняются на сервере: комната живёт только пока активно WebSocket-соединение.

## Бесплатный тариф и ограничения

Проект использует Cloudflare Workers и Durable Objects. Бесплатные квоты Cloudflare ограничены; они не означают гарантированную поддержку любого числа одновременных игроков. Реальную нагрузку, доступность Cloudflare из сетей игроков и квоты нужно проверять тестированием.

## Локальный запуск

```bash
npm install
npm run dev
```

## Технологии

- React 18, Vite, Zustand
- Cloudflare Workers + SQLite-backed Durable Objects
- WebSocket relay, без WebRTC, Firebase и PeerJS

## Multi-backend online rooms

Online rooms try Firebase and Supabase first (Firebase is preferred for approximately 70% of newly-created rooms, Supabase for approximately 30%); Cloudflare is the final fallback. The selected backend is included in the invite URL as `backend=...`, so both players join the same room service. The room-code-only flow probes Firebase, Supabase, then Cloudflare.

### Supabase setup

The browser uses the project's URL and `sb_publishable_...` key in `src/lib/supabaseConfig.js`. In the Supabase Dashboard, open **Realtime → Settings** and make sure **Allow public access to channels** is enabled. This implementation uses public Realtime Broadcast and Presence channels; no Postgres table or SQL migration is required. Anyone who knows a room code and has the public project key can join/listen to that public room, so room codes should not be treated as secrets for sensitive data. Do not put a Supabase secret key in the frontend.

### Important limitations

- Provider selection is probabilistic, not a global live connection counter. It does not guarantee that Firebase will never reach its 100-connection Spark limit; when a new room cannot be created there, the client falls back to Supabase and then Cloudflare.
- Existing rooms stay on the backend where they were created. If that backend is unreachable only from the guest's network, trying another backend cannot magically move the existing room. The host must create a new room on a reachable backend and share its new link.
- Public Realtime channels rely on Supabase's **Allow public access to channels** setting. If public access is disabled, Realtime connections will fail unless authorization policies are added.
