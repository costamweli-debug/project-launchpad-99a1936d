
-- 1. Add level to profiles (global per-user) and quiz_sessions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'NSSCO';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_level_check CHECK (level IN ('NSSCO','AS'));

ALTER TABLE public.quiz_sessions ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'NSSCO';
ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_level_check CHECK (level IN ('NSSCO','AS'));

-- 2. Curriculum tables (public, read by any authenticated user; writes via service_role only)
CREATE TABLE public.curriculum_subjects (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '📘',
  color text NOT NULL DEFAULT '#60a5fa',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'OTHER',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.curriculum_subjects TO authenticated;
GRANT ALL ON public.curriculum_subjects TO service_role;
ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read subjects" ON public.curriculum_subjects FOR SELECT TO authenticated USING (true);

CREATE TABLE public.curriculum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text NOT NULL REFERENCES public.curriculum_subjects(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('NSSCO','AS')),
  slug text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, level, slug)
);
GRANT SELECT ON public.curriculum_topics TO authenticated;
GRANT ALL ON public.curriculum_topics TO service_role;
ALTER TABLE public.curriculum_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read topics" ON public.curriculum_topics FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_curriculum_topics_subject_level ON public.curriculum_topics(subject_id, level, sort_order);

CREATE TABLE public.curriculum_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, slug)
);
GRANT SELECT ON public.curriculum_subtopics TO authenticated;
GRANT ALL ON public.curriculum_subtopics TO service_role;
ALTER TABLE public.curriculum_subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read subtopics" ON public.curriculum_subtopics FOR SELECT TO authenticated USING (true);

-- updated_at triggers
CREATE TRIGGER trg_curriculum_subjects_updated BEFORE UPDATE ON public.curriculum_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_curriculum_topics_updated BEFORE UPDATE ON public.curriculum_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed subjects
INSERT INTO public.curriculum_subjects (id, name, emoji, color, description, category, sort_order) VALUES
  ('mathematics',     'Mathematics',              '🔢', '#2dd4a8', 'Master numbers, algebra, geometry, and calculus.',                'CORE', 10),
  ('english',         'English',                  '📚', '#60a5fa', 'Build your grammar, comprehension, and writing skills.',          'CORE', 20),
  ('biology',         'Biology',                  '🧬', '#22c55e', 'Study cells, genetics, ecology, and the diversity of life.',     'CORE', 30),
  ('physics',         'Physics',                  '⚡', '#f59e0b', 'Forces, energy, waves, and the laws of the universe.',           'CORE', 40),
  ('chemistry',       'Chemistry',                '🧪', '#ec4899', 'Atoms, reactions, organic chemistry, and more.',                  'CORE', 50),
  ('accounting',      'Accounting',               '📊', '#a78bfa', 'Financial statements, bookkeeping, and business finance.',        'COMMERCIAL', 110),
  ('business-studies','Business Studies',         '📈', '#eab308', 'Entrepreneurship, marketing, management, and finance.',           'COMMERCIAL', 120),
  ('economics',       'Economics',                '💹', '#10b981', 'Markets, money, and how economies work.',                         'COMMERCIAL', 130),
  ('geography',       'Geography',                '🌍', '#f97316', 'Maps, climate, and human settlement.',                            'HUMANITIES', 210),
  ('history',         'History',                  '📜', '#b45309', 'African history, world wars, and independence movements.',        'HUMANITIES', 220),
  ('oshiwambo',       'Oshiwambo',                '🗣️', '#f43f5e', 'Read, write, and speak Oshiwambo with confidence.',               'LANGUAGES', 310),
  ('afrikaans',       'Afrikaans',                '🗣️', '#fb923c', 'Afrikaans grammar, comprehension, and writing.',                  'LANGUAGES', 320),
  ('german',          'German',                   '🇩🇪', '#facc15', 'Deutsche Grammatik und Konversation.',                            'LANGUAGES', 330),
  ('french',          'French',                   '🇫🇷', '#818cf8', 'Grammaire, vocabulaire et expression française.',                 'LANGUAGES', 340),
  ('computer-science','Computer Science / ICT',   '💻', '#38bdf8', 'Programming, algorithms, and how computer systems work.',         'TECHNICAL', 410),
  ('design-technology','Design & Technology',     '🛠️', '#94a3b8', 'Design thinking, materials, and product development.',            'TECHNICAL', 420),
  ('technical-drawing','Technical Drawing',       '📐', '#64748b', 'Orthographic, isometric, and engineering drawings.',              'TECHNICAL', 430),
  ('agriculture',     'Agriculture',              '🌾', '#84cc16', 'Crop production, livestock, and soil science.',                   'TECHNICAL', 440),
  ('life-skills',     'Life Skills',              '💡', '#f472b6', 'Personal development, decision-making, and citizenship.',         'OTHER', 510)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, emoji = EXCLUDED.emoji, color = EXCLUDED.color,
  description = EXCLUDED.description, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order;

-- 4. Seed topics. Helper macro: insert (subject, level, slug, name, sort).
-- NSSCO topics (preserve existing slugs used by current routes)
INSERT INTO public.curriculum_topics (subject_id, level, slug, name, sort_order) VALUES
  -- Mathematics NSSCO
  ('mathematics','NSSCO','algebra','Algebra',10),
  ('mathematics','NSSCO','geometry','Geometry',20),
  ('mathematics','NSSCO','trigonometry','Trigonometry',30),
  ('mathematics','NSSCO','calculus','Calculus',40),
  ('mathematics','NSSCO','statistics','Statistics',50),
  ('mathematics','NSSCO','number-theory','Number Theory',60),
  ('mathematics','NSSCO','functions','Functions & Graphs',70),
  ('mathematics','NSSCO','probability','Probability',80),
  -- Mathematics AS
  ('mathematics','AS','pure-algebra','Pure Mathematics: Algebra',10),
  ('mathematics','AS','pure-functions','Functions & Transformations',20),
  ('mathematics','AS','coordinate-geometry','Coordinate Geometry',30),
  ('mathematics','AS','circular-measure','Circular Measure',40),
  ('mathematics','AS','trig-identities','Trigonometric Identities',50),
  ('mathematics','AS','series','Series & Binomial Expansion',60),
  ('mathematics','AS','differentiation','Differentiation',70),
  ('mathematics','AS','integration','Integration',80),
  ('mathematics','AS','vectors','Vectors',90),
  ('mathematics','AS','mechanics-kinematics','Mechanics: Kinematics',100),
  ('mathematics','AS','probability-distributions','Probability Distributions',110),
  -- English NSSCO
  ('english','NSSCO','grammar','Grammar & Usage',10),
  ('english','NSSCO','comprehension','Reading Comprehension',20),
  ('english','NSSCO','essay-writing','Essay Writing',30),
  ('english','NSSCO','literature','Literature',40),
  ('english','NSSCO','vocabulary','Vocabulary',50),
  ('english','NSSCO','summary','Summary Writing',60),
  ('english','NSSCO','letter-writing','Letter Writing',70),
  ('english','NSSCO','poetry','Poetry Analysis',80),
  -- English AS
  ('english','AS','directed-writing','Directed Writing',10),
  ('english','AS','discursive-essays','Discursive & Argumentative Essays',20),
  ('english','AS','text-analysis','Text Analysis & Commentary',30),
  ('english','AS','prose-fiction','Prose Fiction',40),
  ('english','AS','poetry-analysis-as','Poetry: Close Reading',50),
  ('english','AS','drama','Drama',60),
  ('english','AS','language-change','Language Change & Variation',70),
  -- Biology NSSCO
  ('biology','NSSCO','cell-biology','Cell Biology',10),
  ('biology','NSSCO','genetics','Genetics & Heredity',20),
  ('biology','NSSCO','ecology','Ecology',30),
  ('biology','NSSCO','human-biology','Human Biology',40),
  ('biology','NSSCO','plant-biology','Plant Biology',50),
  ('biology','NSSCO','microbiology','Microbiology',60),
  ('biology','NSSCO','evolution','Evolution',70),
  ('biology','NSSCO','biotechnology','Biotechnology',80),
  -- Biology AS
  ('biology','AS','biological-molecules','Biological Molecules',10),
  ('biology','AS','cell-structure-as','Cell Structure & Membranes',20),
  ('biology','AS','enzymes','Enzymes',30),
  ('biology','AS','dna-protein-synthesis','DNA & Protein Synthesis',40),
  ('biology','AS','transport-mammals','Transport in Mammals',50),
  ('biology','AS','transport-plants','Transport in Plants',60),
  ('biology','AS','gas-exchange','Gas Exchange',70),
  ('biology','AS','infectious-disease','Infectious Disease & Immunity',80),
  -- Physics NSSCO
  ('physics','NSSCO','mechanics','Mechanics',10),
  ('physics','NSSCO','waves','Waves & Optics',20),
  ('physics','NSSCO','electricity','Electricity & Magnetism',30),
  ('physics','NSSCO','thermodynamics','Thermodynamics',40),
  ('physics','NSSCO','modern-physics','Modern Physics',50),
  ('physics','NSSCO','forces','Forces & Motion',60),
  ('physics','NSSCO','energy','Energy & Work',70),
  ('physics','NSSCO','nuclear','Nuclear Physics',80),
  -- Physics AS
  ('physics','AS','physical-quantities','Physical Quantities & Units',10),
  ('physics','AS','kinematics-as','Kinematics',20),
  ('physics','AS','dynamics-as','Dynamics',30),
  ('physics','AS','forces-density','Forces, Density & Pressure',40),
  ('physics','AS','work-energy-power','Work, Energy & Power',50),
  ('physics','AS','deformation','Deformation of Solids',60),
  ('physics','AS','waves-as','Waves & Superposition',70),
  ('physics','AS','electric-circuits','Electric Circuits',80),
  ('physics','AS','particle-physics','Particle Physics',90),
  -- Chemistry NSSCO
  ('chemistry','NSSCO','atomic-structure','Atomic Structure',10),
  ('chemistry','NSSCO','chemical-bonding','Chemical Bonding',20),
  ('chemistry','NSSCO','periodic-table','Periodic Table',30),
  ('chemistry','NSSCO','organic-chemistry','Organic Chemistry',40),
  ('chemistry','NSSCO','chemical-reactions','Chemical Reactions',50),
  ('chemistry','NSSCO','acids-bases','Acids & Bases',60),
  ('chemistry','NSSCO','stoichiometry','Stoichiometry',70),
  ('chemistry','NSSCO','electrochemistry','Electrochemistry',80),
  -- Chemistry AS
  ('chemistry','AS','atoms-molecules-stoich','Atoms, Molecules & Stoichiometry',10),
  ('chemistry','AS','atomic-structure-as','Atomic Structure',20),
  ('chemistry','AS','chemical-bonding-as','Chemical Bonding',30),
  ('chemistry','AS','states-of-matter','States of Matter',40),
  ('chemistry','AS','chemical-energetics','Chemical Energetics',50),
  ('chemistry','AS','electrochemistry-as','Electrochemistry',60),
  ('chemistry','AS','equilibria','Equilibria',70),
  ('chemistry','AS','reaction-kinetics','Reaction Kinetics',80),
  ('chemistry','AS','organic-as','Organic Chemistry (Hydrocarbons & Halogenoalkanes)',90),
  -- Accounting NSSCO
  ('accounting','NSSCO','bookkeeping','Bookkeeping',10),
  ('accounting','NSSCO','financial-statements','Financial Statements',20),
  ('accounting','NSSCO','bank-reconciliation','Bank Reconciliation',30),
  ('accounting','NSSCO','depreciation','Depreciation',40),
  ('accounting','NSSCO','budgeting','Budgeting',50),
  ('accounting','NSSCO','cost-accounting','Cost Accounting',60),
  ('accounting','NSSCO','vat','VAT & Taxation',70),
  ('accounting','NSSCO','inventory','Inventory Management',80),
  -- Accounting AS
  ('accounting','AS','double-entry','Double-Entry Bookkeeping',10),
  ('accounting','AS','financial-statements-as','Financial Statements of Sole Traders',20),
  ('accounting','AS','partnerships','Partnership Accounts',30),
  ('accounting','AS','company-accounts','Limited Company Accounts',40),
  ('accounting','AS','ratio-analysis','Ratio Analysis',50),
  ('accounting','AS','cash-flow','Cash Flow Statements',60),
  ('accounting','AS','manufacturing','Manufacturing Accounts',70),
  -- Business Studies NSSCO
  ('business-studies','NSSCO','entrepreneurship','Entrepreneurship',10),
  ('business-studies','NSSCO','marketing','Marketing',20),
  ('business-studies','NSSCO','management','Management',30),
  ('business-studies','NSSCO','business-finance','Business Finance',40),
  -- Business Studies AS
  ('business-studies','AS','business-environment','Business & Its Environment',10),
  ('business-studies','AS','people-in-business','People in Business',20),
  ('business-studies','AS','marketing-as','Marketing Strategy',30),
  ('business-studies','AS','operations','Operations Management',40),
  ('business-studies','AS','finance-as','Finance & Accounting',50),
  -- Economics NSSCO
  ('economics','NSSCO','supply-demand','Supply and Demand',10),
  ('economics','NSSCO','inflation','Inflation',20),
  ('economics','NSSCO','market-structures','Market Structures',30),
  ('economics','NSSCO','macroeconomics','Macroeconomics',40),
  -- Economics AS
  ('economics','AS','basic-economic-problem','The Basic Economic Problem',10),
  ('economics','AS','price-system','The Price System & Microeconomy',20),
  ('economics','AS','government-microeconomic','Government Microeconomic Intervention',30),
  ('economics','AS','macroeconomy','The Macroeconomy',40),
  ('economics','AS','government-macro','Government Macroeconomic Intervention',50),
  ('economics','AS','international-trade','International Economic Issues',60),
  -- Geography NSSCO
  ('geography','NSSCO','map-work','Map Work',10),
  ('geography','NSSCO','climate','Climate & Weather',20),
  ('geography','NSSCO','population','Population Studies',30),
  ('geography','NSSCO','natural-resources','Natural Resources',40),
  ('geography','NSSCO','geomorphology','Geomorphology',50),
  ('geography','NSSCO','economic-geography','Economic Geography',60),
  ('geography','NSSCO','namibia','Namibia Geography',70),
  ('geography','NSSCO','africa','African Geography',80),
  -- Geography AS
  ('geography','AS','hydrology-fluvial','Hydrology & Fluvial Geomorphology',10),
  ('geography','AS','atmosphere-weather','Atmosphere & Weather',20),
  ('geography','AS','rocks-weathering','Rocks & Weathering',30),
  ('geography','AS','population-as','Population',40),
  ('geography','AS','migration','Migration',50),
  ('geography','AS','settlement','Settlement Dynamics',60),
  -- History NSSCO
  ('history','NSSCO','african-history','African History',10),
  ('history','NSSCO','world-wars','World Wars',20),
  ('history','NSSCO','colonialism','Colonialism',30),
  ('history','NSSCO','independence-movements','Independence Movements',40),
  -- History AS
  ('history','AS','europe-1815-1917','Modern Europe 1815–1917',10),
  ('history','AS','international-1919-1991','International History 1919–1991',20),
  ('history','AS','africa-1945','Africa Since 1945',30),
  ('history','AS','namibia-history','History of Namibia',40),
  -- Languages (NSSCO baseline; AS Level optional)
  ('oshiwambo','NSSCO','grammar','Grammar',10),
  ('oshiwambo','NSSCO','comprehension','Comprehension',20),
  ('oshiwambo','NSSCO','composition','Composition',30),
  ('oshiwambo','NSSCO','oral','Oral Communication',40),
  ('oshiwambo','NSSCO','culture','Culture & Literature',50),
  ('afrikaans','NSSCO','taalkunde','Taalkunde (Grammar)',10),
  ('afrikaans','NSSCO','begrip','Begrip (Comprehension)',20),
  ('afrikaans','NSSCO','opstel','Opstel (Essay)',30),
  ('afrikaans','NSSCO','letterkunde','Letterkunde (Literature)',40),
  ('afrikaans','NSSCO','mondeling','Mondeling (Oral)',50),
  ('german','NSSCO','grammatik','Grammatik',10),
  ('german','NSSCO','wortschatz','Wortschatz',20),
  ('german','NSSCO','leseverstehen','Leseverstehen',30),
  ('german','NSSCO','schreiben','Schreiben',40),
  ('german','NSSCO','sprechen','Sprechen',50),
  ('french','NSSCO','grammaire','Grammaire',10),
  ('french','NSSCO','vocabulaire','Vocabulaire',20),
  ('french','NSSCO','comprehension-fr','Compréhension',30),
  ('french','NSSCO','expression-ecrite','Expression écrite',40),
  ('french','NSSCO','expression-orale','Expression orale',50),
  -- Computer Science NSSCO
  ('computer-science','NSSCO','programming-basics','Programming Basics',10),
  ('computer-science','NSSCO','algorithms','Algorithms',20),
  ('computer-science','NSSCO','data-representation','Data Representation',30),
  ('computer-science','NSSCO','computer-systems','Computer Systems',40),
  -- Computer Science AS
  ('computer-science','AS','info-representation','Information Representation',10),
  ('computer-science','AS','communication-networks','Communication & Networks',20),
  ('computer-science','AS','hardware-software','Hardware & Software',30),
  ('computer-science','AS','programming-as','Programming (Python / VB / Java)',40),
  ('computer-science','AS','data-structures-as','Data Structures',50),
  ('computer-science','AS','databases','Databases & SQL',60),
  ('computer-science','AS','security-ethics','Security, Privacy & Ethics',70),
  -- Design & Technology
  ('design-technology','NSSCO','design-process','The Design Process',10),
  ('design-technology','NSSCO','materials','Materials & Components',20),
  ('design-technology','NSSCO','tools-equipment','Tools & Equipment',30),
  ('design-technology','NSSCO','manufacturing-techniques','Manufacturing Techniques',40),
  ('design-technology','NSSCO','sustainability','Sustainability & Ethics',50),
  -- Technical Drawing
  ('technical-drawing','NSSCO','orthographic','Orthographic Projection',10),
  ('technical-drawing','NSSCO','isometric','Isometric Drawing',20),
  ('technical-drawing','NSSCO','sectional-views','Sectional Views',30),
  ('technical-drawing','NSSCO','dimensioning','Dimensioning & Tolerances',40),
  ('technical-drawing','NSSCO','building-drawing','Building Drawing',50),
  -- Agriculture
  ('agriculture','NSSCO','soil-science','Soil Science',10),
  ('agriculture','NSSCO','crop-production','Crop Production',20),
  ('agriculture','NSSCO','livestock','Livestock Production',30),
  ('agriculture','NSSCO','farm-management','Farm Management',40),
  ('agriculture','NSSCO','agribusiness','Agribusiness',50),
  -- Life Skills
  ('life-skills','NSSCO','self-awareness','Self-Awareness & Identity',10),
  ('life-skills','NSSCO','decision-making','Decision-Making',20),
  ('life-skills','NSSCO','relationships','Relationships & Communication',30),
  ('life-skills','NSSCO','health-wellbeing','Health & Wellbeing',40),
  ('life-skills','NSSCO','citizenship','Citizenship & Human Rights',50),
  ('life-skills','NSSCO','career-planning','Career Planning',60)
ON CONFLICT (subject_id, level, slug) DO NOTHING;
