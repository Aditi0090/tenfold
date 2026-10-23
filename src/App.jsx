import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Navbar, Footer } from './components/Layout.jsx';
import { RequireAuth, RequireAdmin } from './components/Guards.jsx';
import { isConfigured } from './lib/supabase.js';

import Home from './pages/Home.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Charities from './pages/Charities.jsx';
import CharityDetail from './pages/CharityDetail.jsx';
import Results from './pages/Results.jsx';
import Subscribe from './pages/Subscribe.jsx';
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import CheckoutSuccess from './pages/CheckoutSuccess.jsx';
import Donate from './pages/Donate.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';

import Loader from './components/Loader.jsx';

// Admin screens are code-split so members never download them.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminOverview = lazy(() => import('./pages/admin/Overview.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminUserDetail = lazy(() => import('./pages/admin/UserDetail.jsx'));
const AdminDraws = lazy(() => import('./pages/admin/Draws.jsx'));
const AdminCharities = lazy(() => import('./pages/admin/Charities.jsx'));
const AdminWinners = lazy(() => import('./pages/admin/Winners.jsx'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  if (!isConfigured) {
    return (
      <div className="wrap section">
        <h1>Almost there</h1>
        <p className="lede">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your environment
          (a <code>.env</code> file locally, or Vercel → Settings → Environment Variables), then rebuild.</p>
      </div>
    );
  }
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main>
        <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/charities" element={<Charities />} />
          <Route path="/charities/:slug" element={<CharityDetail />} />
          <Route path="/results" element={<Results />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="draws" element={<AdminDraws />} />
            <Route path="charities" element={<AdminCharities />} />
            <Route path="winners" element={<AdminWinners />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
    </>
  );
}
