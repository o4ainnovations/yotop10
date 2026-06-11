import type { Metadata } from 'next';
import SettingsClient from './client';

export const metadata: Metadata = {
  title: 'Settings — YoTop10',
  description: 'Manage your account, display name, and identity.',
};

export default function SettingsPage() {
  return <SettingsClient />;
}
