import React, { type ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  actions?: ReactNode;
}

const PageHero: React.FC<PageHeroProps> = ({ title, subtitle, eyebrow = 'Car rental workspace', actions }) => (
  <div className="relative isolate overflow-hidden rounded-2xl border border-[#285b88]/70 bg-[#071d38] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
    <img
      src="/assets/login_background_car_left.jpg"
      alt=""
      aria-hidden="true"
      className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_58%]"
    />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,18,39,0.3)_0%,rgba(5,27,54,0.24)_44%,rgba(5,27,54,0.12)_100%)]" />
    <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6ab3ff]">{eyebrow}</p>}
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-blue-100/75 sm:text-base">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </div>
);

export default PageHero;
