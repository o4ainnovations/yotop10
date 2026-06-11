import type { Metadata } from 'next';
import AccountSettingsClient from './client';

export const metadata: Metadata = {
  title: 'Account Settings — YoTop10',
  description: 'Manage your display name, logout, and identity transfer.',
};

export default function AccountSettingsPage() {
  return <AccountSettingsClient />;
}
