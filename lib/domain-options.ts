export const DOMAIN_OPTIONS = [
  'Data Engineering',
  'Java',
  'C Sharp',
  'Dotnet',
  'Mainframe',
  'Python',
  'Cloud',
  'DevOps',
  'Testing',
  'Business Analyst',
  'UI/UX',
  'General',
]

export function normalizeDomain(value?: string | null) {
  const input = (value || '').trim()
  if (!input) return 'General'
  const match = DOMAIN_OPTIONS.find((domain) => domain.toLowerCase() === input.toLowerCase())
  return match || input
}
