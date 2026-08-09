import { Link } from 'react-router-dom'

import {
  ActionLink,
  FeatureItem,
  HowToStep,
  ImagePlaceholder,
  InstallGuide,
  MixerSection,
  SectionTitle,
} from '../components/lp/LandingPageComponents'

const features = [
  {
    number: '01',
    title: '.msczをそのまま表示',
    text: 'MuseScoreファイルを読み込み、そのまま高精細な楽譜で表示します。',
  },
  {
    number: '02',
    title: '音符をタップして発音',
    text: '気になる音符をタップすると、その音だけをすぐに再生します。',
  },
  {
    number: '03',
    title: '再生位置を自動で追従',
    text: '再生中は青い縦ラインが移動し、今どこを再生しているかが一目でわかります。',
  },
]

const installGuides = [
  {
    title: 'iPhone・iPad（Safari）',
    steps: [
      '上のボタンからアプリ画面を開く',
      '画面下の共有ボタンをタップ',
      '「ホーム画面に追加」を選ぶ',
    ],
  },
  {
    title: 'Android（Chrome）',
    steps: [
      '上のボタンからアプリ画面を開く',
      '画面右上のメニューをタップ',
      '「アプリをインストール」を選ぶ',
    ],
  },
]

const howToSteps = [
  ['ファイルを選ぶ', '端末内の.msczを選択'],
  ['楽譜が開く', 'すぐに譜面が表示される'],
  ['タップ・再生して練習', 'タップで音を確かめながら練習'],
] as const

const containerClass =
  'mx-auto w-[calc(100%-2rem)] max-w-295 md:w-[calc(100%-3rem)]'

export const LandingPage = () => (
  <div className="min-h-screen bg-white font-sans text-sm text-[#0c1118] md:text-base">
    <header className="flex h-13.5 items-center justify-between border-b-4 border-[#2975ff] bg-[#061b33] px-4 text-white md:h-18 md:px-[max(24px,calc((100%-1180px)/2))]">
      <Link
        className="text-[17px] font-extrabold tracking-[-0.03em] md:text-[28px]"
        to="/lp"
      >
        MuseScore Player
      </Link>
      <nav
        className="flex items-center gap-4.5 text-[11px] font-bold md:gap-11 md:text-sm"
        aria-label="メインナビゲーション"
      >
        <a className="hidden md:block" href="#about">
          ABOUT
        </a>
        <Link to="/">アプリを開く ↗</Link>
      </nav>
    </header>

    <main>
      <section
        className={`${containerClass} grid gap-7 py-6 md:grid-cols-[0.88fr_1.12fr] md:gap-10.5 md:pt-10.5 md:pb-12`}
      >
        <div>
          <p className="mb-5 text-sm text-[#8792a1] md:mb-7">
            musescore-player&nbsp; / &nbsp;about
          </p>
          <p className="text-sm font-extrabold tracking-[0.03em] text-[#1261ec]">
            MSCZ PLAYER FOR VOCAL PRACTICE
          </p>
          <h1 className="my-5 text-[29px] leading-[1.55] font-extrabold tracking-[0.02em] md:text-[clamp(32px,4vw,46px)] md:leading-normal">
            スマホで譜面を開く。
            <br />
            その音を、すぐ確かめる。
          </h1>
          <p className="leading-[1.8]">
            MuseScoreファイルをブラウザで表示・再生。
            <br />
            気になる音符はタップして、その場で音を確認できます。
          </p>
          <div className="mt-6 grid max-w-117.5 gap-4 md:mt-9">
            <ActionLink to="/">アプリを開いて試す → /</ActionLink>
            <ActionLink href="#features" variant="outline">
              デモ楽譜を見る
            </ActionLink>
          </div>
          <p className="mx-1 mt-7 text-sm text-[#4c5968]">
            <span className="mr-2.5 text-[22px]" aria-hidden="true">
              ♙
            </span>
            ファイルはサーバーに送信されません
          </p>
        </div>
        <ImagePlaceholder
          className="min-h-80 shadow-[0_10px_30px_#18314b18] min-[421px]:min-h-97.5 md:min-h-163.75"
          label="アプリ画面"
        />
      </section>

      <section className={`${containerClass} pb-4.5`} id="features">
        <SectionTitle>音取りに必要な操作を、譜面の上で。</SectionTitle>
        {features.map((feature) => (
          <FeatureItem key={feature.number} {...feature} />
        ))}
      </section>

      <MixerSection />

      <section
        className={`${containerClass} grid gap-6 border-b border-[#aab8c8] py-7 md:grid-cols-[1fr_1.5fr] md:gap-9.5 md:pt-9.5`}
        id="about"
      >
        <article>
          <SectionTitle>小さい画面でも、読みやすく。</SectionTitle>
          <div className="flex flex-wrap items-center md:gap-6">
            <span className="rounded-l-[7px] border border-[#173c70] px-5.5 py-3.75 text-[22px]">
              −
            </span>
            <b className="border-y border-[#173c70] px-5.5 py-3.75 text-[22px]">
              100%
            </b>
            <span className="rounded-r-[7px] border border-[#173c70] px-5.5 py-3.75 text-[22px]">
              ＋
            </span>
            <p className="mt-3.5 w-full leading-[1.6] md:mt-0 md:ml-3.5 md:w-auto">
              25%から250%まで
              <br />
              譜面サイズを調整。
            </p>
          </div>
        </article>
        <article className="border-t border-[#7890aa] pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-9.5">
          <SectionTitle>アップロードせず、ブラウザの中で完結。</SectionTitle>
          <ImagePlaceholder
            className="min-h-26.25"
            label="ファイル処理の流れ"
          />
        </article>
      </section>

      <section
        className={`${containerClass} border-b border-[#70859c] pt-8 pb-5`}
      >
        <div className="md:flex md:items-start md:justify-between">
          <div>
            <SectionTitle>
              アプリ画面をホーム画面に追加して、すぐ練習。
            </SectionTitle>
            <p className="leading-6 text-[#374150]">
              この紹介ページではなく、先に「アプリを開く」ボタンから実際のアプリ画面を開いてください。
              <br />
              その画面をホーム画面に追加すると、次からはアイコンをタップするだけで使えます。
            </p>
            <ActionLink className="mt-1 w-fit px-5" size="compact" to="/">
              実際のアプリ画面を開く → /
            </ActionLink>
          </div>
          <div
            className="relative mx-auto mt-6 grid size-20.5 place-items-center rounded-2xl bg-[#061b33] text-[40px] text-white md:mt-0 md:mr-[18%]"
            aria-label="MuseScore Player アイコン"
          >
            m̊
            <small className="absolute top-22 w-27.5 text-center text-xs text-black">
              MuseScore
              <br />
              Player
            </small>
          </div>
        </div>
        <div className="mt-16 grid gap-8.5 md:mt-11 md:grid-cols-2 md:gap-13">
          {installGuides.map((guide) => (
            <InstallGuide key={guide.title} {...guide} />
          ))}
        </div>
        <p className="mt-6.5 border-l-4 border-[#1261ec] bg-[#edf5ff] px-4 py-3.25 leading-[1.7] font-bold text-[#17365d]">
          追加するのは、この紹介ページではなく実際のアプリ画面です。追加後はホーム画面の「MuseScore
          Player」から開けます。
        </p>
      </section>

      <section className={`${containerClass} pt-6 pb-4`}>
        <SectionTitle>使い方は3ステップ</SectionTitle>
        <div className="grid gap-6.5 md:grid-cols-3 md:gap-11">
          {howToSteps.map(([title, text], index) => (
            <HowToStep
              key={title}
              number={index + 1}
              title={title}
              text={text}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto w-[calc(100%-1.5rem)] max-w-295 rounded-md bg-radial from-[#12375b] to-[#061b33] px-3.5 py-6.5 text-center text-white md:w-[calc(100%-3rem)] md:p-7.5">
        <h2 className="mb-3.5 text-[23px] font-extrabold tracking-[0.08em] md:text-[34px]">
          次の音取りを、スマホから。
        </h2>
        <ActionLink
          className="mx-auto mb-2.5 max-w-120 text-xl"
          size="large"
          to="/"
          variant="light"
        >
          アプリを開く → /
        </ActionLink>
        <p className="my-1">musescore-player /</p>
        <small>対応形式 .mscz / インストール不要</small>
      </section>
    </main>

    <footer
      className={`${containerClass} flex flex-wrap gap-7.5 px-2 pt-4.5 pb-6.5 text-[13px] md:gap-17.5`}
    >
      <Link to="/">アプリ /</Link>
      <a href="#about">このアプリについて / about</a>
    </footer>
  </div>
)
