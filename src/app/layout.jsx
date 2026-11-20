import Providers from './Providers';
// Fonts are bundled with the site (no request to Google Fonts before the page can show).
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/figtree';
import '@fontsource-variable/jetbrains-mono';
import '../styles/index.css';
import '../styles/theme-dark-utilities.css';
import '../styles/theme.css';

export const metadata = {
  title: 'Auto Dealer',
  description: 'Buy and sell used and new cars, motorcycles, buses, trucks, construction and farm machinery from private sellers, agents and verified dealers.',
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Applies the saved light/dark choice before the first paint (no flash of the wrong theme).
const themeScript = `try{var t=localStorage.getItem('autodealer-theme');t=t==='dark'||t==='light'?t:'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
