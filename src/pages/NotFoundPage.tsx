import { Link } from 'react-router-dom'

export const NotFoundPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
    <div className="w-full max-w-lg text-center">
      <p className="mb-3 font-bold tracking-[0.2em] text-blue-600">
        404 Not Found
      </p>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
        ページが見つかりません
      </h1>
      <p className="mb-8 leading-7 text-slate-600">
        入力されたアドレスが間違っているか、ページが移動した可能性があります。
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          className="rounded-md bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700"
          to="/"
        >
          アプリを開く
        </Link>
        <Link
          className="rounded-md border border-slate-400 bg-white px-6 py-3 font-bold text-slate-800 transition hover:bg-slate-100"
          to="/lp"
        >
          紹介ページを見る
        </Link>
      </div>
    </div>
  </main>
)
