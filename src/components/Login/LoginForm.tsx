import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getCompanyConfig, loadCompanyConfig } from '../../lib/company';
import { supabase } from '../../lib/supabase';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

const backgroundImage = '/assets/Πολυτελές_SUV_στο_Ηλιοβασίλεμα_της_Ακτής.png';

const LoginForm: React.FC = () => {
  const { language } = useLanguage();
  const { login } = useAuth();
  const [companyName, setCompanyName] = useState(getCompanyConfig().name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');

  const isEnglish = language === 'en';
  const copy = isEnglish
    ? {
        tagline: 'Freedom for every journey',
        headline: 'Reliable\nreservation management',
        description: 'A complete solution for managing your fleet, reservations and customers.',
        booking: 'Manage reservations',
        fleet: 'Monitor your fleet',
        growth: 'Grow your business',
        subtitle: 'Reservation Management System',
        email: 'Email address',
        password: 'Password',
        signIn: 'Sign in',
        signingIn: 'Signing in...',
        forgot: 'Forgot your password?',
        recoveryTitle: 'Reset your password',
        recoveryDescription: 'Enter your email and we will send you a secure link to set a new password.',
        send: 'Send recovery email',
        sending: 'Sending...',
        back: 'Back to sign in',
        requiredEmail: 'Please enter your email address.',
        recoverySent: 'A recovery email was sent. Check your inbox and follow the link to set a new password.',
        recoveryFailed: 'Unable to send recovery email.',
        invalidLogin: 'Incorrect email or password.',
      }
    : {
        tagline: 'Ελευθερία σε κάθε διαδρομή',
        headline: 'Αξιόπιστη\nδιαχείριση κρατήσεων',
        description: 'Ολοκληρωμένη λύση για τη διαχείριση του στόλου, των κρατήσεων και των πελατών σας.',
        booking: 'Διαχειριστείτε κρατήσεις',
        fleet: 'Παρακολουθήστε τον στόλο σας',
        growth: 'Αναπτύξτε την επιχείρησή σας',
        subtitle: 'Σύστημα Διαχείρισης Κρατήσεων',
        email: 'Email address',
        password: 'Κωδικός πρόσβασης',
        signIn: 'Σύνδεση',
        signingIn: 'Σύνδεση...',
        forgot: 'Ξέχασα τον κωδικό μου',
        recoveryTitle: 'Ανάκτηση κωδικού πρόσβασης',
        recoveryDescription: 'Εισάγετε το email σας για να λάβετε ασφαλή σύνδεσμο και να ορίσετε νέο κωδικό.',
        send: 'Αποστολή email ανάκτησης',
        sending: 'Αποστολή...',
        back: 'Επιστροφή στη σύνδεση',
        requiredEmail: 'Παρακαλώ εισάγετε το email σας.',
        recoverySent: 'Στάλθηκε email ανάκτησης. Ελέγξτε τα εισερχόμενά σας και ακολουθήστε τον σύνδεσμο για νέο κωδικό.',
        recoveryFailed: 'Αποτυχία αποστολής email ανάκτησης.',
        invalidLogin: 'Λανθασμένο email ή κωδικός πρόσβασης.',
      };

  useEffect(() => {
    let mounted = true;
    loadCompanyConfig().then((config) => {
      if (mounted) setCompanyName(config.name);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await login(email, password);
    } catch {
      setErrorMsg(copy.invalidLogin);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');

    const emailToUse = forgotEmail || email;
    if (!emailToUse) {
      setForgotError(copy.requiredEmail);
      setForgotLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: 'https://tsakonakisj-earnwise-uvvy.bolt.host/update-password',
      });
      if (error) throw error;
      setForgotMsg(copy.recoverySent);
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.recoveryFailed;
      setForgotError(message || copy.recoveryFailed);
    } finally {
      setForgotLoading(false);
    }
  };

  const switchToLogin = () => {
    setShowForgot(false);
    setForgotMsg('');
    setForgotError('');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061a35] text-white">
      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,22,49,0.84)_0%,rgba(4,28,59,0.55)_42%,rgba(3,19,42,0.82)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_55%,rgba(35,103,185,0.22),transparent_42%)]" />
      <div className="absolute -right-32 top-[-18%] h-[125%] w-[43%] rotate-[30deg] bg-[#0a2e5c]/45 blur-[1px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] items-center px-5 py-8 sm:px-8 lg:px-14 lg:py-12">
        <section className="hidden max-w-[620px] flex-1 py-10 lg:block xl:max-w-[680px]">
          <div className="mb-12 flex items-center gap-3 text-[#9dc7ff]">
            <span className="h-1 w-14 rounded-full bg-[#1680ff]" />
            <span className="text-base font-semibold tracking-[0.08em]">{copy.tagline}</span>
          </div>
          <h1 className="max-w-[650px] whitespace-pre-line text-5xl font-semibold leading-[1.08] tracking-[-0.035em] text-white xl:text-6xl">
            {copy.headline}
          </h1>
          <p className="mt-7 max-w-[560px] text-lg leading-8 text-blue-100/80 xl:text-xl">{copy.description}</p>

          <div className="mt-12 grid max-w-[600px] grid-cols-3 gap-5">
            <Feature icon={CalendarDaysIcon} label={copy.booking} />
            <Feature icon={TruckIcon} label={copy.fleet} />
            <Feature icon={ChartBarIcon} label={copy.growth} />
          </div>
        </section>

        <section className="mx-auto w-full max-w-[500px] lg:ml-auto lg:mr-0 lg:max-w-[540px]">
          <div className="rounded-[26px] border border-blue-200/35 bg-[#061a35]/75 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-10 lg:p-12">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d315e]/70 ring-1 ring-blue-300/25 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                <TruckIcon className="h-9 w-9 text-[#1680ff]" strokeWidth={1.7} />
              </div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">{companyName}</h2>
              <p className="mt-3 text-base text-blue-100/75">{showForgot ? copy.recoveryTitle : copy.subtitle}</p>
            </div>

            {showForgot ? (
              <form className="mt-10 space-y-5" onSubmit={handleForgotPassword}>
                <p className="text-center text-sm leading-6 text-blue-100/70">{copy.recoveryDescription}</p>
                <Field
                  id="forgot-email"
                  label={copy.email}
                  type="email"
                  value={forgotEmail}
                  onChange={setForgotEmail}
                  icon={EnvelopeIcon}
                  autoComplete="email"
                />
                {forgotError && <Message tone="error">{forgotError}</Message>}
                {forgotMsg && (
                  <Message tone="success" icon={CheckCircleIcon}>
                    {forgotMsg}
                  </Message>
                )}
                <button type="submit" disabled={forgotLoading} className="primary-button">
                  {forgotLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : copy.send}
                </button>
                <button type="button" onClick={switchToLogin} className="secondary-link">
                  {copy.back}
                </button>
              </form>
            ) : (
              <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
                <Field
                  id="email"
                  label={copy.email}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  icon={EnvelopeIcon}
                  autoComplete="email"
                />
                <Field
                  id="password"
                  label={copy.password}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  icon={LockClosedIcon}
                  autoComplete="current-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="rounded-md p-1 text-blue-100/70 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#1680ff]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  }
                />
                {errorMsg && <Message tone="error">{errorMsg}</Message>}
                <button type="submit" disabled={loading} className="primary-button">
                  {loading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <>{copy.signIn}<ArrowRightIcon className="h-5 w-5" /></>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgot(true);
                  }}
                  className="secondary-link"
                >
                  {copy.forgot}
                </button>
              </form>
            )}
          </div>
          <p className="mt-6 text-center text-xs tracking-wide text-blue-100/45">{isEnglish ? 'Secure access to your workspace' : 'Ασφαλής πρόσβαση στον χώρο εργασίας σας'}</p>
        </section>
      </div>
    </main>
  );
};

interface FeatureProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
}

const Feature: React.FC<FeatureProps> = ({ icon: Icon, label }) => (
  <div className="space-y-3">
    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-blue-200/30 bg-blue-100/10 text-[#5aa7ff] shadow-[0_8px_25px_rgba(0,0,0,0.18)]">
      <Icon className="h-7 w-7" strokeWidth={1.7} />
    </div>
    <p className="max-w-[130px] text-sm font-medium leading-5 text-white/85">{label}</p>
  </div>
);

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  autoComplete: string;
  trailing?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ id, label, type, value, onChange, icon: Icon, autoComplete, trailing }) => (
  <div>
    <label htmlFor={id} className="sr-only">{label}</label>
    <div className="flex items-center rounded-xl border border-blue-200/25 bg-[#123257]/75 px-4 transition-colors focus-within:border-[#1680ff] focus-within:ring-2 focus-within:ring-[#1680ff]/25">
      <Icon className="h-5 w-5 flex-shrink-0 text-blue-100/75" strokeWidth={1.8} />
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent px-4 py-4 text-base text-white outline-none placeholder:text-blue-100/60"
        placeholder={label}
      />
      {trailing}
    </div>
  </div>
);

interface MessageProps {
  children: React.ReactNode;
  tone: 'error' | 'success';
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const Message: React.FC<MessageProps> = ({ children, tone, icon: Icon }) => (
  <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm leading-5 ${tone === 'error' ? 'border-red-300/30 bg-red-950/40 text-red-100' : 'border-emerald-300/30 bg-emerald-950/40 text-emerald-100'}`}>
    {Icon && <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />}
    <p>{children}</p>
  </div>
);

export default LoginForm;
