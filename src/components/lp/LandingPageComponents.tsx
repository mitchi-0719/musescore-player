import type { ReactNode } from 'react'

import { Link } from 'react-router-dom'

const classNames = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(' ')

export const SectionTitle = ({
  children,
  id,
}: {
  children: ReactNode
  id?: string
}) => (
  <h2
    className="mb-5 text-xl font-extrabold tracking-[0.02em] md:text-[25px]"
    id={id}
  >
    {children}
  </h2>
)

export const LandingScreenshot = ({
  alt,
  className,
  objectPosition = 'center',
  src,
}: {
  alt: string
  className?: string
  objectPosition?: string
  src: string
}) => (
  <figure
    className={classNames(
      'relative min-h-47.5 overflow-hidden rounded-[7px] border-[1.5px] border-[#b7c1ce] bg-[#f4f7fc]',
      className
    )}
  >
    <img
      className="absolute inset-0 size-full object-cover"
      src={src}
      alt={alt}
      style={{ objectPosition }}
    />
  </figure>
)

type ActionLinkProps = {
  children: ReactNode
  className?: string
  href?: string
  size?: 'default' | 'compact' | 'large'
  to?: string
  variant?: 'primary' | 'outline' | 'light'
}

export const ActionLink = ({
  children,
  className,
  href,
  size = 'default',
  to,
  variant = 'primary',
}: ActionLinkProps) => {
  const classes = classNames(
    'flex items-center justify-center rounded-[7px] font-extrabold transition',
    size === 'default'
      ? 'min-h-13 md:min-h-16'
      : size === 'compact'
        ? 'min-h-11'
        : 'min-h-14.5',
    variant === 'primary'
      ? 'bg-linear-[110deg] from-[#286ef3] to-[#075bea] text-white shadow-[0_7px_20px_#145fe92e] hover:brightness-105'
      : variant === 'outline'
        ? 'border-2 border-[#153c71] text-[#0a3269] hover:bg-blue-50'
        : 'bg-white text-[#092848] hover:bg-slate-100',
    className
  )

  return to ? (
    <Link className={classes} to={to}>
      {children}
    </Link>
  ) : (
    <a className={classes} href={href}>
      {children}
    </a>
  )
}

type FeatureItemProps = {
  imagePosition: string
  imageSrc: string
  number: string
  title: string
  text: string
}

export const FeatureItem = ({
  imagePosition,
  imageSrc,
  number,
  title,
  text,
}: FeatureItemProps) => (
  <article className="grid items-center gap-4.5 border-b border-[#aab8c8] pt-4.5 pb-6 md:grid-cols-2 md:gap-15.5 md:pb-4.5">
    <LandingScreenshot
      className="min-h-46.25"
      src={imageSrc}
      alt={`${title}の画面`}
      objectPosition={imagePosition}
    />
    <div>
      <h3 className="mb-4 text-lg font-extrabold md:text-[23px]">
        <b className="mr-2.5 text-[25px] md:text-[34px]">{number}</b>
        {title}
      </h3>
      <p className="leading-[1.8] md:text-[17px]">{text}</p>
    </div>
  </article>
)

const channels = [
  { name: 'Master', value: '0.0', level: 31 },
  { name: 'Metronome', value: '-6.0', level: 50 },
  { name: 'Lead', value: '0.0', level: 31 },
  { name: 'Top', value: '-2.0', level: 42, active: true },
  { name: '2nd', value: '-3.0', level: 48 },
  { name: '3rd', value: '-4.0', level: 52 },
  { name: 'Bass', value: '-3.0', level: 48 },
  { name: 'VP', value: '-∞', level: 77, active: true },
  { name: 'Hand Clap', value: '-8.0', level: 61 },
]

const MixerChannel = ({
  active,
  level,
  name,
  value,
}: (typeof channels)[number]) => (
  <div className="flex h-60 flex-col items-center rounded-[3px] border border-[#577087] px-2 py-3 md:h-71.25">
    <strong className="min-h-7.25 text-xs">{name}</strong>
    <div className="flex gap-3.5 text-[11px]">
      <span className="rounded-sm border border-[#778da1] px-1.75 py-1.25">
        M
      </span>
      <span
        className={classNames(
          'rounded-sm border border-[#778da1] px-1.75 py-1.25',
          active && 'bg-[#2772ef]'
        )}
      >
        S
      </span>
    </div>
    <div className="relative my-2.5 h-28.75 w-0.75 bg-[#91a0ae] md:h-38.75">
      <i
        className="absolute left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_#000]"
        style={{ top: `${level}%` }}
      />
    </div>
    <output className="text-sm font-bold">{value}</output>
  </div>
)

export const MixerSection = () => (
  <section
    className="bg-radial-[at_50%_0] from-[#12395e] to-[#061b33] to-60% px-4 pt-7 pb-4.5 text-white md:px-6"
    aria-labelledby="mixer-title"
  >
    <div className="mx-auto max-w-295">
      <SectionTitle id="mixer-title">
        自分の声部だけ、しっかり聴く。
      </SectionTitle>
      <div className="overflow-x-auto pb-1.5">
        <div className="grid min-w-198 grid-cols-9 md:min-w-232.5 md:grid-cols-[repeat(9,minmax(100px,1fr))]">
          {channels.map((channel) => (
            <MixerChannel key={channel.name} {...channel} />
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-[#bdc9d6]">
        ← ••••••• 左右にスクロールできます ••••••• →
      </p>
    </div>
  </section>
)

export const HowToStep = ({
  imagePosition,
  imageSrc,
  number,
  text,
  title,
}: {
  imagePosition: string
  imageSrc: string
  number: number
  text: string
  title: string
}) => (
  <article>
    <h3 className="mb-4 flex items-center gap-3.75 text-lg font-extrabold">
      <span className="grid size-6.75 place-items-center rounded-full bg-[#0a3269] text-white">
        {number}
      </span>
      {title}
    </h3>
    <LandingScreenshot
      className="min-h-45 md:min-h-32.5"
      src={imageSrc}
      alt={`${title}の画面`}
      objectPosition={imagePosition}
    />
    <p className="my-2 text-center text-[13px]">{text}</p>
  </article>
)
