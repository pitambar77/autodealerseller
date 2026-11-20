import {
  BarChart3, Bell, MessageSquareText, Car, Shapes, CreditCard, FileCheck2, FileText, GitCompareArrows, Handshake, Heart, Inbox, LayoutDashboard, Landmark, ListChecks, PlusCircle, Search, Settings, ShieldCheck, UserCog, Users, AlertOctagon,
  CheckCheck, DatabaseBackup, History, Image, Lock, UsersRound, LifeBuoy,
} from 'lucide-react';

// Sidebar navigation per role. `match` lets nested routes highlight their parent.
// Admin items list the permission they need (`perm`: any of these); dealer items list what a
// dealership team member needs (`team`), and `owner: true` items are for the account owner only.
export const NAV = {
  dealer: [
    { to: '/dealer', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/dealer/listings', label: 'Listings', icon: Car, match: ['/dealer/vehicles'] },
    { to: '/dealer/vehicles/new', label: 'Add vehicle', icon: PlusCircle, team: 'listings.create' },
    { to: '/dealer/enquiries', label: 'Enquiries', icon: Inbox, badge: 'messages', team: 'enquiries.respond' },
    { to: '/dealer/documents', label: 'Business documents', icon: FileCheck2, team: 'documents.manage' },
    { to: '/payments', label: 'Payments', icon: CreditCard, match: ['/checkout'], team: ['payments.view', 'listings.publish'] },
    { to: '/dealer/team', label: 'Team', icon: UsersRound, owner: true },
    { to: '/account', label: 'Account', icon: UserCog },
  ],
  seller: [
    { to: '/seller', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/seller/listings', label: 'My listings', icon: Car, match: ['/seller/vehicles/'] },
    { to: '/seller/vehicles/new', label: 'Add vehicle', icon: PlusCircle },
    { to: '/seller/enquiries', label: 'Enquiries', icon: Inbox, badge: 'messages' },
    { to: '/seller/listing-status', label: 'Listing status', icon: ListChecks },
    { to: '/seller/identity', label: 'Identity verification', icon: ShieldCheck },
    { to: '/payments', label: 'Payments', icon: CreditCard, match: ['/checkout'] },
    { to: '/account', label: 'Account', icon: UserCog },
  ],
  agent: [
    { to: '/agent', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/agent/listings', label: 'Listings & enquiries', icon: Inbox, badge: 'messages' },
    { to: '/agent/vehicles/new', label: 'Add vehicle', icon: PlusCircle, match: ['/agent/vehicles'] },
    { to: '/agent/handover', label: 'Handover tracking', icon: Handshake },
    { to: '/agent/documents', label: 'ID & authorisation', icon: FileCheck2 },
    { to: '/payments', label: 'Payments', icon: CreditCard, match: ['/checkout'] },
    { to: '/account', label: 'Account', icon: UserCog },
  ],
  buyer: [
    { to: '/buyer', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/buyer/messages', label: 'Messages', icon: MessageSquareText, badge: 'messages' },
    { to: '/buyer/saved', label: 'Saved vehicles', icon: Heart },
    { to: '/compare', label: 'Compare', icon: GitCompareArrows },
    { to: '/cars', label: 'Browse vehicles', icon: Search },
    { to: '/account', label: 'Account', icon: UserCog },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/approvals', label: 'Approvals', icon: CheckCheck, badge: 'approvals' },
    { to: '/admin/users', label: 'Users', icon: Users, perm: ['users.view'] },
    { to: '/admin/documents', label: 'Document queue', icon: FileText, badge: 'docs', perm: ['documents.review'] },
    { to: '/admin/listings', label: 'Listings', icon: Car, badge: 'flags', perm: ['listings.view', 'listings.moderate'] },
    { to: '/admin/categories', label: 'Vehicle categories', icon: Shapes, perm: ['categories.manage'] },
    { to: '/admin/support', label: 'Customer issues', icon: LifeBuoy, perm: ['support.manage'] },
    { to: '/admin/payments', label: 'Payments & reconciliation', icon: CreditCard, perm: ['payments.view', 'payments.reconcile'] },
    { to: '/admin/loan-referrals', label: 'Loan referrals', icon: Landmark, perm: ['referrals.view'] },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3, perm: ['reports.view'] },
    { to: '/admin/content', label: 'Website content', icon: Image, perm: ['content.manage'] },
    { to: '/admin/settings', label: 'Configuration', icon: Settings, perm: ['config.manage', 'finance.settings', 'system.integrations'] },
    { to: '/admin/team', label: 'Team & roles', icon: UserCog, perm: ['staff.manage'] },
    { to: '/admin/security', label: 'Security', icon: Lock, perm: ['system.security', 'staff.manage'] },
    { to: '/admin/backups', label: 'Backups', icon: DatabaseBackup, perm: ['system.backups'] },
    { to: '/admin/activity', label: 'Activity log', icon: History },
  ],
};

export const ICONS = { Bell, AlertOctagon };

/** Every screen in the brief, used by the demo navigator. */
export const SCREENS = [
  ['Public website', [
    [1, 'Home', '/'], [2, 'Browse / search', '/cars'], [3, 'Vehicle details', '/cars/v1005'], [4, 'Vehicle verification help', '/verify-vehicle'],
    [5, 'Loan calculator', '/loan-calculator'], [6, 'How it works / plans', '/how-it-works'], [7, 'Contact & support', '/support'],
  ]],
  ['Account & payments', [
    [8, 'Role selection', '/register'], [9, 'Sign in (phone)', '/signin'], [10, 'OTP verification', '/verify-otp'], [11, 'Account settings', '/account', 'dealer'],
    [12, 'Listing plan & checkout', '/checkout/v1009', 'dealer'], [13, 'Payment result & history', '/payments', 'dealer'],
  ]],
  ['Registration (separate URLs)', [
    [44, 'Register as private seller', '/register/seller'], [45, 'Register as agent', '/register/agent'], [43, 'Register as dealer', '/register/dealer'],
    [46, 'Register as buyer', '/register/buyer'], [47, 'Admin invite & 2FA setup', '/admin/invite'],
  ]],
  ['Private seller', [
    [19, 'Seller dashboard', '/seller', 'seller'], [20, 'Identity upload', '/seller/identity', 'seller'], [21, 'Seller vehicle form', '/seller/vehicles/new', 'seller'], [64, 'Seller listings', '/seller/listings', 'seller'], [65, 'Seller enquiries & chat', '/seller/enquiries', 'seller'], [22, 'Duplicate detection / status', '/seller/listing-status', 'seller'],
  ]],
  ['Agent', [
    [23, 'Agent dashboard', '/agent', 'agent'], [24, 'ID & owner authorisation', '/agent/documents', 'agent'], [25, 'Agent vehicle form', '/agent/vehicles/new', 'agent'],
    [26, 'Ownership / handover tracking', '/agent/handover', 'agent'], [27, 'Listings & enquiries', '/agent/listings', 'agent'],
  ]],
  ['Dealer', [
    [14, 'Dealer dashboard', '/dealer', 'dealer'], [15, 'Business documents', '/dealer/documents', 'dealer'], [16, 'Vehicle form (multi-step)', '/dealer/vehicles/new', 'dealer'],
    [17, 'Listing management & offers', '/dealer/listings', 'dealer'], [18, 'Enquiries', '/dealer/enquiries', 'dealer'], [67, 'Dealership team', '/dealer/team', 'dealer'],
  ]],
  ['Buyer', [
    [28, 'Buyer sign-in / onboarding', '/buyer/welcome'], [29, 'Buyer dashboard', '/buyer', 'buyer'], [66, 'Buyer messages', '/buyer/messages', 'buyer'], [30, 'Saved vehicles', '/buyer/saved', 'buyer'], [31, 'Compare vehicles', '/compare'], [32, 'Contact / enquiry', '/cars/v1005/contact'], [48, "Seller's other listings", '/sellers/u_seller2'], [49, 'Dealer directory', '/dealers'], [50, 'Dealer profile & inventory', '/dealers/u_dealer1'], [51, 'Finance enquiry (calculator)', '/loan-calculator?car=v1005'], [52, 'Finance enquiry tracker', '/finance-enquiry/FE-1001', 'buyer'], [53, 'Partner bank lead desk', '/bank-portal', 'bank'], [54, 'Motorcycles for sale', '/motorcycles'], [55, 'Motorcycle details', '/motorcycles/v5003'], [56, 'Trucks & trailers for sale', '/trucks-trailers'], [57, 'Truck details', '/trucks-trailers/v6003'], [60, 'Buses & minibuses', '/buses'], [61, 'Construction machinery', '/construction-machinery'], [62, 'Farm machinery', '/farm-machinery'], [58, 'Sell a motorcycle (dealer)', '/dealer/vehicles/new?type=motorcycle', 'dealer'], [59, 'Truck dealer profile', '/dealers/u_dealer8'],
  ]],
  ['Administrator', [
    [33, 'Admin login', '/admin/login'], [34, 'Admin dashboard', '/admin', 'admin'], [35, 'Platform configuration', '/admin/settings', 'admin'], [63, 'Vehicle categories', '/admin/categories', 'admin'], [36, 'User directory', '/admin/users', 'admin'],
    [37, 'Document queue', '/admin/documents', 'admin'], [38, 'Listings moderation', '/admin/listings', 'admin'], [39, 'Listing detail & audit', '/admin/listings/v1003', 'admin'],
    [40, 'Payments & reconciliation', '/admin/payments', 'admin'], [41, 'Loan referrals', '/admin/loan-referrals', 'admin'], [42, 'Reports & monitoring', '/admin/reports', 'admin'],
    [68, 'Approvals (maker-checker)', '/admin/approvals', 'admin'], [69, 'Team & roles', '/admin/team', 'admin'], [70, 'Security', '/admin/security', 'admin'], [71, 'Activity log', '/admin/activity', 'admin'],
    [72, 'Backups', '/admin/backups', 'admin'], [73, 'Website content (banner)', '/admin/content', 'admin'], [74, 'Customer issues', '/admin/support', 'admin'],
  ]],
];

/** Admin pages and the permissions that open them (any one). Pages not listed are open to all staff. */
export const ADMIN_PAGE_PERMS = [
  ['/admin/users', ['users.view']],
  ['/admin/documents', ['documents.review']],
  ['/admin/listings', ['listings.view', 'listings.moderate']],
  ['/admin/categories', ['categories.manage']],
  ['/admin/support', ['support.manage']],
  ['/admin/payments', ['payments.view', 'payments.reconcile']],
  ['/admin/loan-referrals', ['referrals.view']],
  ['/admin/reports', ['reports.view']],
  ['/admin/content', ['content.manage']],
  ['/admin/settings', ['config.manage', 'finance.settings', 'system.integrations']],
  ['/admin/team', ['staff.manage']],
  ['/admin/security', ['system.security', 'staff.manage']],
  ['/admin/backups', ['system.backups']],
];
/** Dealer pages a team member needs a permission for. */
export const DEALER_PAGE_TEAM = [
  ['/dealer/vehicles/new', 'listings.create'],
  ['/dealer/enquiries', 'enquiries.respond'],
  ['/dealer/documents', 'documents.manage'],
  ['/payments', ['payments.view', 'listings.publish']],
  ['/checkout', 'listings.publish'],
  ['/dealer/team', 'owner'],
];
