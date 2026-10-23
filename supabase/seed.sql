-- Starter charities. Safe to re-run (upserts on slug).
-- Images are optional: without one the site renders a generated gradient
-- cover. Admins can upload real images from Admin → Charities.
insert into public.charities (name, slug, tagline, description, category, location, website, featured, events)
values
 ('Bright Minds Foundation', 'bright-minds',
  'Mental-health support for young people, before crisis point.',
  'Bright Minds funds free counselling sessions in schools and runs a 24/7 text line for 11–25 year olds. Every £30 pays for one hour of one-to-one support.',
  'Mental health', 'Manchester, UK', 'https://example.org/bright-minds', true,
  '[{"title":"Charity golf day","date":"2026-12-05","location":"Wilmslow"},{"title":"Spring fun run","date":"2027-03-14","location":"Manchester"}]'),
 ('Clean Water Collective', 'clean-water',
  'Wells, filters and training for villages without safe water.',
  'Working with local engineers across East Africa to build and maintain boreholes. Communities own the well, and we train two caretakers per site.',
  'Water & sanitation', 'Kampala, Uganda', 'https://example.org/clean-water', true,
  '[{"title":"Members'' fundraiser dinner","date":"2026-11-28","location":"London"}]'),
 ('Second Chance Animal Rescue', 'second-chance',
  'Rescue, rehabilitate and rehome abandoned dogs and cats.',
  'A volunteer-run shelter that has rehomed over 4,000 animals. Funds cover vet bills, food and the foster network.',
  'Animal welfare', 'Bristol, UK', 'https://example.org/second-chance', false,
  '[{"title":"Open day & sponsored walk","date":"2027-01-17","location":"Bristol"}]'),
 ('Open Book Literacy', 'open-book',
  'Every child reading confidently by age 11.',
  'Trained volunteers read one-to-one with primary-school children who are falling behind. Books are theirs to keep.',
  'Education', 'Birmingham, UK', 'https://example.org/open-book', true,
  '[{"title":"Charity golf day","date":"2027-04-22","location":"Sutton Coldfield"}]'),
 ('Heartline Cardiac Research', 'heartline',
  'Funding research into early detection of heart disease.',
  'Heartline funds early-career researchers developing low-cost screening that GPs can use in a ten-minute appointment.',
  'Medical research', 'Edinburgh, UK', 'https://example.org/heartline', false,
  '[]'),
 ('Green Canopy Trust', 'green-canopy',
  'Planting native woodland and restoring urban green space.',
  'Volunteers plant and care for native trees in towns with the least green cover. 1 tree planted and protected for every £5.',
  'Environment', 'Leeds, UK', 'https://example.org/green-canopy', false,
  '[{"title":"Winter planting weekend","date":"2026-12-12","location":"Leeds"}]')
on conflict (slug) do update set
  name = excluded.name, tagline = excluded.tagline, description = excluded.description,
  category = excluded.category, location = excluded.location, website = excluded.website,
  featured = excluded.featured, events = excluded.events;
