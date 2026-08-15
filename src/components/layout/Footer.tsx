const externalLinkClass =
  'underline decoration-slate-300 underline-offset-4 hover:text-blue-600'

export const Footer = () => (
  <footer className="mt-10 border-t border-slate-200 bg-white px-5 py-8 text-xs leading-5 text-slate-500">
    <div className="mx-auto grid w-full max-w-5xl gap-6 sm:grid-cols-2">
      <div>
        <p className="font-bold text-[#071b47]">Refinear</p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <a
            className={externalLinkClass}
            href="https://github.com/mitchi-0719/refinear"
            target="_blank"
            rel="noreferrer"
          >
            GitHubリポジトリ
          </a>
          <a
            className={externalLinkClass}
            href="https://x.com/39Panda_3939"
            target="_blank"
            rel="noreferrer"
          >
            制作者のX
          </a>
        </div>
        <p className="mt-3">© Refinear</p>
      </div>

      <div>
        <p className="font-bold text-[#071b47]">
          使用音源・アイコンについて / Credits
        </p>
        <ul className="mt-2 space-y-2">
          <li>
            ピアノ：
            <a
              className={externalLinkClass}
              href="https://github.com/Tonejs/audio/tree/master/salamander"
              target="_blank"
              rel="noreferrer"
            >
              Salamander Grand Piano V3
            </a>{' '}
            by Alexander Holm（CC BY 3.0、一部改変）
          </li>
          <li>
            ドラム：
            <a
              className={externalLinkClass}
              href="https://github.com/teropa/drumkit"
              target="_blank"
              rel="noreferrer"
            >
              teropa/drumkit
            </a>
            （DWDS: CC BY、Stomachache / Karman Lyne: CC0、一部改変）
          </li>
          <li>
            画面内のアイコン：
            <a
              className={externalLinkClass}
              href="https://github.com/google/material-design-icons"
              target="_blank"
              rel="noreferrer"
            >
              Google Material Icons
            </a>
            （Apache License 2.0）、
            <a
              className={externalLinkClass}
              href="https://icons8.com"
              target="_blank"
              rel="noreferrer"
            >
              Icons8
            </a>
          </li>
        </ul>
      </div>
    </div>
  </footer>
)
