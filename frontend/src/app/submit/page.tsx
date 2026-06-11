import { redirect } from 'next/navigation';

export default function OldSubmitRedirect() {
  redirect('/new');
}
