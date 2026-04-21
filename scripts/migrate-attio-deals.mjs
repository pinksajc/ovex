// One-time migration: import Attio deals into Supabase
// Run with: node scripts/migrate-attio-deals.mjs

const SUPABASE_URL = 'https://pqkzdeezkelfcbbfvnqu.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxa3pkZWV6a2VsZmNiYmZ2bnF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ0OTI3MiwiZXhwIjoyMDkwMDI1MjcyfQ.TwiGHfJzCEBp7jdB2iqNpddCigC7yg3WXUEuBnw7b3E'

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

// Stage mapping Attio → Orvex
function mapStage(attioStage) {
  if (attioStage === 'Won 🎉') return 'closed_won'
  if (attioStage === 'Lost')   return 'closed_lost'
  if (attioStage === 'In Progress') return 'qualified'
  return 'prospecting' // Lead and anything else
}

// All 87 deals from Attio
const ATTIO_DEALS = [
  { name: 'Poyo club',                    stage: 'Lead'        },
  { name: 'Carupanadas',                  stage: 'Lead'        },
  { name: 'TORO BURGER',                  stage: 'Lead'        },
  { name: 'UTOPICO',                      stage: 'Lead'        },
  { name: 'Hatillo Madrid',               stage: 'Lead'        },
  { name: 'Tacoletos Madrid',             stage: 'Lead'        },
  { name: 'Reginella Ristorante',         stage: 'Lost'        },
  { name: 'Kricky Pelton Smashburgers',   stage: 'Lead'        },
  { name: 'Los Pastorcitos',              stage: 'Lead'        },
  { name: 'Hype Smashburgers',            stage: 'Lead'        },
  { name: 'Street Burger',                stage: 'In Progress' },
  { name: 'Mateo Honten',                 stage: 'Lead'        },
  { name: 'Kevabro',                      stage: 'In Progress' },
  { name: 'TROMPO',                       stage: 'Lead'        },
  { name: "JACK'S SMASH BURGER",          stage: 'Lead'        },
  { name: 'Smash Cow',                    stage: 'Lost'        },
  { name: 'Kitchen 154',                  stage: 'Lead'        },
  { name: 'MASA',                         stage: 'Lead'        },
  { name: 'La Freseria',                  stage: 'Lead'        },
  { name: 'Macas',                        stage: 'Lead'        },
  { name: 'NAP Neapolitan Authentic Pizza', stage: 'Lead'      },
  { name: 'DF BAR',                       stage: 'Lead'        },
  { name: 'Restaurante Mezcal',           stage: 'Lead'        },
  { name: 'Kebi',                         stage: 'In Progress' },
  { name: 'Mexcalista',                   stage: 'Lead'        },
  { name: 'Dalú Burger',                  stage: 'Lead'        },
  { name: 'Maison Umami',                 stage: 'Lead'        },
  { name: 'Beata Pasta',                  stage: 'Lead'        },
  { name: 'Manteca',                      stage: 'Lead'        },
  { name: 'PIZZA RADICAL',                stage: 'Lead'        },
  { name: 'El Borrón',                    stage: 'In Progress' },
  { name: 'UP CHICKEN MADRID',            stage: 'Lead'        },
  { name: 'Burnout Burgers',              stage: 'Lost'        },
  { name: 'Omono Restaurant',             stage: 'Lead'        },
  { name: 'Culto GmbH',                   stage: 'Won 🎉'      },
  { name: "NANU'S Hamburguesas Madrid",   stage: 'Lead'        },
  { name: 'Las Muns Empanadas',           stage: 'Lead'        },
  { name: 'Sick Smash Burgers',           stage: 'Lead'        },
  { name: 'Distrito Burger',              stage: 'Lead'        },
  { name: 'MYTOKYS MADRID',               stage: 'Lead'        },
  { name: 'GalgoSmash',                   stage: 'Lead'        },
  { name: 'RONGJI Restaurante Chino',     stage: 'Lead'        },
  { name: 'Corvina Miches y Ceviches',    stage: 'Lead'        },
  { name: 'Pacífico Smashburgers',        stage: 'Lead'        },
  { name: 'Los Aguachiles',               stage: 'Lead'        },
  { name: "Pink's!!",                     stage: 'Won 🎉'      },
  { name: 'Perritos Calientes Galipán',   stage: 'Lead'        },
  { name: 'LA REVOLUCIÓN BURGER',         stage: 'Lead'        },
  { name: 'Xurreria Laietana',            stage: 'In Progress' },
  { name: 'AZTLAN Restaurante',           stage: 'Lead'        },
  { name: 'MilwaukeeBurger',              stage: 'Lead'        },
  { name: 'El Japo Sushi',               stage: 'Lead'        },
  { name: 'Deleito',                      stage: 'Lead'        },
  { name: 'AKIBA Restaurante',            stage: 'Lead'        },
  { name: 'Jekes',                        stage: 'Lead'        },
  { name: 'Yakiniku Rikyu',               stage: 'Lead'        },
  { name: 'Santoku',                      stage: 'Lead'        },
  { name: 'TAQUELA',                      stage: 'Lead'        },
  { name: 'Katz Madrid',                  stage: 'Lead'        },
  { name: 'La Leyenda del Agave',         stage: 'Lead'        },
  { name: 'Marlons',                      stage: 'Lead'        },
  { name: 'Onda.mad Smashburgers',        stage: 'Lead'        },
  { name: 'Lulú Pizza',                   stage: 'Lead'        },
  { name: 'De Pita Madre',                stage: 'Lead'        },
  { name: 'Trebbiano',                    stage: 'Lead'        },
  { name: 'Kuikku',                       stage: 'Lead'        },
  { name: 'Tatemado Restaurante Mexicano', stage: 'Lead'       },
  { name: 'Katsu',                        stage: 'Lead'        },
  { name: 'Parking Pizza',                stage: 'Lead'        },
  { name: '99 Sushi Bar Madrid',          stage: 'Lost'        },
  { name: 'Miso Sushi Bar',               stage: 'Lead'        },
  { name: 'La Brigaderie',                stage: 'In Progress' },
  { name: 'TEPIC Mexican Restaurant',     stage: 'Lost'        },
  { name: 'PEK Pollo Estilo Coreano',     stage: 'Lead'        },
  { name: 'TKO TACOS',                    stage: 'Lead'        },
  { name: 'El Pinche Taco',               stage: 'Lead'        },
  { name: 'Home Burgers & Shakes',        stage: 'Lead'        },
  { name: 'STREET FOOD BURGER',           stage: 'Lead'        },
  { name: 'Sushi Matako',                 stage: 'Lead'        },
  { name: 'BURGERJAZZ',                   stage: 'Lead'        },
  { name: 'HUNDRED BURGERS',              stage: 'Lead'        },
  { name: 'Street Grills',                stage: 'In Progress' },
  { name: 'La Empanadera',                stage: 'Lead'        },
  { name: 'SHEN Japanese Restaurant',     stage: 'Lead'        },
  { name: 'Not from Italy',               stage: 'In Progress' },
  { name: 'MAZÚL',                        stage: 'Lead'        },
  { name: 'TACOS DON MANOLITO',           stage: 'Lost'        },
]

async function main() {
  // 1. Fetch existing deals to avoid duplicates
  console.log('Fetching existing deals from Supabase…')
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/deals?select=company_name`,
    { headers: HEADERS }
  ).then(r => r.json())

  const existingNames = new Set(existing.map(d => d.company_name))
  console.log(`Found ${existingNames.size} existing deals in Supabase`)

  // 2. Filter out already-imported deals
  const toInsert = ATTIO_DEALS
    .filter(d => !existingNames.has(d.name))
    .map(d => ({
      company_name: d.name,
      stage: mapStage(d.stage),
    }))

  console.log(`Skipping ${ATTIO_DEALS.length - toInsert.length} already existing`)
  console.log(`Inserting ${toInsert.length} new deals…`)

  if (toInsert.length === 0) {
    console.log('Nothing to insert. Done.')
    return
  }

  // 3. Batch insert
  const res = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(toInsert),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Insert failed:', err)
    process.exit(1)
  }

  const inserted = await res.json()
  console.log(`✓ Inserted ${inserted.length} deals successfully`)
  inserted.forEach(d => console.log(`  · ${d.company_name} (${d.stage})`))
}

main().catch(err => { console.error(err); process.exit(1) })
