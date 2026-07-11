export interface Topic {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  topics: Topic[];
}

export const SUBJECTS: Subject[] = [
  {
    id: "mathematics",
    name: "Mathematics",
    emoji: "🔢",
    description: "Master numbers, algebra, geometry, and calculus for your NSSCO exams.",
    color: "#2dd4a8",
    topics: [
      { id: "algebra", name: "Algebra" },
      { id: "geometry", name: "Geometry" },
      { id: "trigonometry", name: "Trigonometry" },
      { id: "calculus", name: "Calculus" },
      { id: "statistics", name: "Statistics" },
      { id: "number-theory", name: "Number Theory" },
      { id: "functions", name: "Functions & Graphs" },
      { id: "probability", name: "Probability" },
    ],
  },
  {
    id: "english",
    name: "English",
    emoji: "📚",
    description: "Build your grammar, comprehension, and writing skills.",
    color: "#60a5fa",
    topics: [
      { id: "grammar", name: "Grammar & Usage" },
      { id: "comprehension", name: "Reading Comprehension" },
      { id: "essay-writing", name: "Essay Writing" },
      { id: "literature", name: "Literature" },
      { id: "vocabulary", name: "Vocabulary" },
      { id: "summary", name: "Summary Writing" },
      { id: "letter-writing", name: "Letter Writing" },
      { id: "poetry", name: "Poetry Analysis" },
    ],
  },
  {
    id: "physics",
    name: "Physics",
    emoji: "⚡",
    description: "Understand forces, energy, waves, and the laws of the universe.",
    color: "#f59e0b",
    topics: [
      { id: "mechanics", name: "Mechanics" },
      { id: "waves", name: "Waves & Optics" },
      { id: "electricity", name: "Electricity & Magnetism" },
      { id: "thermodynamics", name: "Thermodynamics" },
      { id: "modern-physics", name: "Modern Physics" },
      { id: "forces", name: "Forces & Motion" },
      { id: "energy", name: "Energy & Work" },
      { id: "nuclear", name: "Nuclear Physics" },
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    emoji: "🧪",
    description: "Explore atoms, chemical reactions, organic chemistry, and more.",
    color: "#ec4899",
    topics: [
      { id: "atomic-structure", name: "Atomic Structure" },
      { id: "chemical-bonding", name: "Chemical Bonding" },
      { id: "periodic-table", name: "Periodic Table" },
      { id: "organic-chemistry", name: "Organic Chemistry" },
      { id: "chemical-reactions", name: "Chemical Reactions" },
      { id: "acids-bases", name: "Acids & Bases" },
      { id: "stoichiometry", name: "Stoichiometry" },
      { id: "electrochemistry", name: "Electrochemistry" },
    ],
  },
  {
    id: "biology",
    name: "Biology",
    emoji: "🧬",
    description: "Study cells, genetics, ecology, and the diversity of life.",
    color: "#22c55e",
    topics: [
      { id: "cell-biology", name: "Cell Biology" },
      { id: "genetics", name: "Genetics & Heredity" },
      { id: "ecology", name: "Ecology" },
      { id: "human-biology", name: "Human Biology" },
      { id: "plant-biology", name: "Plant Biology" },
      { id: "microbiology", name: "Microbiology" },
      { id: "evolution", name: "Evolution" },
      { id: "biotechnology", name: "Biotechnology" },
    ],
  },
  {
    id: "accounting",
    name: "Accounting",
    emoji: "📊",
    description: "Learn financial statements, bookkeeping, and business finance.",
    color: "#a78bfa",
    topics: [
      { id: "bookkeeping", name: "Bookkeeping" },
      { id: "financial-statements", name: "Financial Statements" },
      { id: "bank-reconciliation", name: "Bank Reconciliation" },
      { id: "depreciation", name: "Depreciation" },
      { id: "budgeting", name: "Budgeting" },
      { id: "cost-accounting", name: "Cost Accounting" },
      { id: "vat", name: "VAT & Taxation" },
      { id: "inventory", name: "Inventory Management" },
    ],
  },
  {
    id: "geography",
    name: "Geography",
    emoji: "🌍",
    description: "Discover the world through maps, climate, and human settlement.",
    color: "#f97316",
    topics: [
      { id: "map-work", name: "Map Work" },
      { id: "climate", name: "Climate & Weather" },
      { id: "population", name: "Population Studies" },
      { id: "natural-resources", name: "Natural Resources" },
      { id: "geomorphology", name: "Geomorphology" },
      { id: "economic-geography", name: "Economic Geography" },
      { id: "namibia", name: "Namibia Geography" },
      { id: "africa", name: "African Geography" },
    ],
  },
  {
    id: "computer-science",
    name: "Computer Science / ICT",
    emoji: "💻",
    description: "Learn programming, algorithms, and how computer systems work.",
    color: "#38bdf8",
    topics: [
      { id: "programming-basics", name: "Programming Basics" },
      { id: "algorithms", name: "Algorithms" },
      { id: "data-representation", name: "Data Representation" },
      { id: "computer-systems", name: "Computer Systems" },
    ],
  },
  {
    id: "economics",
    name: "Economics",
    emoji: "💹",
    description: "Understand markets, money, and how economies work.",
    color: "#10b981",
    topics: [
      { id: "supply-demand", name: "Supply and Demand" },
      { id: "inflation", name: "Inflation" },
      { id: "market-structures", name: "Market Structures" },
      { id: "macroeconomics", name: "Macroeconomics" },
    ],
  },
  {
    id: "business-studies",
    name: "Business Studies",
    emoji: "📈",
    description: "Study entrepreneurship, marketing, management, and finance.",
    color: "#eab308",
    topics: [
      { id: "entrepreneurship", name: "Entrepreneurship" },
      { id: "marketing", name: "Marketing" },
      { id: "management", name: "Management" },
      { id: "business-finance", name: "Business Finance" },
    ],
  },
  {
    id: "history",
    name: "History",
    emoji: "📜",
    description: "Explore African history, world wars, and independence movements.",
    color: "#b45309",
    topics: [
      { id: "african-history", name: "African History" },
      { id: "world-wars", name: "World Wars" },
      { id: "colonialism", name: "Colonialism" },
      { id: "independence-movements", name: "Independence Movements" },
    ],
  },
  {
    id: "technical-subjects",
    name: "Technical Subjects",
    emoji: "📐",
    description: "Master technical drawing, design, and engineering basics.",
    color: "#64748b",
    topics: [
      { id: "technical-drawing", name: "Technical Drawing" },
      { id: "design-technology", name: "Design & Technology Basics" },
      { id: "engineering-concepts", name: "Engineering Concepts" },
    ],
  },
];

export const RANKS = [
  { name: "Beginner", minScore: 0, emoji: "🌱", color: "#9ca3af" },
  { name: "Intermediate", minScore: 40, emoji: "🌿", color: "#22c55e" },
  { name: "Advanced", minScore: 60, emoji: "🔥", color: "#f59e0b" },
  { name: "Elite", minScore: 80, emoji: "👑", color: "#e11d48" },
];

export function getRank(percentage: number) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (percentage >= RANKS[i].minScore) {
      return RANKS[i];
    }
  }
  return RANKS[0];
}

export function getSubjectById(id: string) {
  return SUBJECTS.find((s) => s.id === id);
}

export function getTopicById(subjectId: string, topicId: string) {
  const subject = getSubjectById(subjectId);
  return subject?.topics.find((t) => t.id === topicId);
}
