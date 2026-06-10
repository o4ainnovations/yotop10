import SubmitClient from './client';

type PageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function SubmitPage({ searchParams }: PageProps) {
  const { type } = await searchParams;
  return <SubmitClient initialType={type as 'top_list' | 'this_vs_that' | 'fact_drop' | 'best_of' | 'worst_of' | undefined} />;
}
