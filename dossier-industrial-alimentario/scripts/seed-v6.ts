// scripts/seed-v6.ts
// HERMES-DOSSIER v6 — Seed idempotente desde data/seed-v6.json
// Sprint 6 — 2026-06-02
// Conecta a hermes_dossier_v6 (NO tocar hermes_dossier legacy)
// USO:
//   DATABASE_URL="postgresql://surus:Surus2024!@127.0.0.1:5432/hermes_dossier_v6" pnpm tsx scripts/seed-v6.ts

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const SEED_PATH = join(process.cwd(), 'data', 'seed-v6.json');

interface SeedCompany {
  slug: string;
  name: string;
  sector: string;
  subsector: string;
  parentGroup?: string;
  hqCity?: string;
  hqRegion?: string;
  facturacionM?: number;
  facturacionYear?: number;
  ebitdaM?: number;
  beneficioNetoM?: number;
  deudaNetaM?: number;
  empleadosTotal?: number;
  tier: string;
  website?: string;
}

interface SeedPlant {
  companySlug: string;
  name: string;
  ccaa: string;
  province?: string;
  city?: string;
  status: string;
  specialty?: string;
  employees?: number;
  parcelaM2?: number;
  naveM2?: number;
  closureYear?: number;
  investmentMEur?: number;
  notes?: string;
}

interface SeedPlantContact {
  companySlug: string;
  plantName: string;
  fullName: string;
  role: string;
  roleCategory?: string;
  linkedinUrl?: string;
  email?: string;
  sourceUrl?: string;
  sourceOutlet?: string;
  confidence?: number;
  notes?: string;
}

interface SeedTechnicalInventory {
  companySlug: string;
  plantName: string;
  category: string;
  brand?: string;
  model?: string;
  specs?: string;
  quantity?: number;
  status: string;
  releaseWindow?: string;
  estimatedValueEur?: number;
  notes?: string;
}

interface SeedOperation {
  companySlug: string;
  type: string;
  title: string;
  description?: string;
  amountMeur?: number;
  jobsAffected?: number;
  announcedAt: string;
  status?: string;
  confidence?: number;
  sourceUrl?: string;
  sourceOutlet?: string;
}

interface SeedTimelineEvent {
  companySlug: string;
  plantName?: string;
  date: string;
  title: string;
  sourceUrl?: string;
  sourceOutlet?: string;
}

interface SeedFinancial {
  companySlug: string;
  year: number;
  concept: string;
  amountMeur: number;
  category?: string;
  plantId?: string;
  sourceUrl?: string;
  notes?: string;
}

interface SeedSource {
  companySlug: string;
  url: string;
  title: string;
  outlet: string;
  outletType: string;
  language?: string;
  deimplantationSignal?: boolean;
  publishedAt?: string;
  notes?: string;
}

interface SeedAuctionCheck {
  companySlug: string;
  companyName: string;
  platform: string;
  result: string;
  details?: string;
}

interface Seed {
  companies: SeedCompany[];
  plants: SeedPlant[];
  plantContacts: SeedPlantContact[];
  technicalInventory: SeedTechnicalInventory[];
  operations: SeedOperation[];
  timelineEvents: SeedTimelineEvent[];
  financials: SeedFinancial[];
  sources: SeedSource[];
  auctionChecks: SeedAuctionCheck[];
}

async function main() {
  if (!existsSync(SEED_PATH)) {
    throw new Error(`No se encontró seed en ${SEED_PATH}`);
  }
  const seed: Seed = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SEED v6 — HERMES Dossier Industrial');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Origen: ${SEED_PATH}`);
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  // ───────────────────────────────────────────────────────
  // 1. COMPANIES
  // ───────────────────────────────────────────────────────
  console.log(`▶ Companies (${seed.companies.length})…`);
  const companyIdBySlug = new Map<string, string>();
  for (const c of seed.companies) {
    const row = await prisma.company.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        sector: c.sector,
        subsector: c.subsector,
        parentGroup: c.parentGroup ?? null,
        hqCity: c.hqCity ?? null,
        hqRegion: c.hqRegion ?? null,
        facturacionM: c.facturacionM ?? null,
        facturacionYear: c.facturacionYear ?? null,
        ebitdaM: c.ebitdaM ?? null,
        beneficioNetoM: c.beneficioNetoM ?? null,
        deudaNetaM: c.deudaNetaM ?? null,
        empleadosTotal: c.empleadosTotal ?? null,
        tier: c.tier,
        website: c.website ?? null,
        status: 'active',
      },
      update: {
        name: c.name,
        sector: c.sector,
        subsector: c.subsector,
        parentGroup: c.parentGroup ?? null,
        hqCity: c.hqCity ?? null,
        hqRegion: c.hqRegion ?? null,
        facturacionM: c.facturacionM ?? null,
        facturacionYear: c.facturacionYear ?? null,
        ebitdaM: c.ebitdaM ?? null,
        beneficioNetoM: c.beneficioNetoM ?? null,
        deudaNetaM: c.deudaNetaM ?? null,
        empleadosTotal: c.empleadosTotal ?? null,
        tier: c.tier,
        website: c.website ?? null,
      },
    });
    companyIdBySlug.set(c.slug, row.id);
  }
  console.log(`  ✓ ${companyIdBySlug.size} companies upserted`);

  // ───────────────────────────────────────────────────────
  // 2. PLANTS
  // ───────────────────────────────────────────────────────
  console.log(`▶ Plants (${seed.plants.length})…`);
  const plantIdByCompanyAndName = new Map<string, string>();
  for (const p of seed.plants) {
    const companyId = companyIdBySlug.get(p.companySlug);
    if (!companyId) {
      console.warn(`  ⚠ Planta sin company: ${p.companySlug}/${p.name}`);
      continue;
    }
    // Look up existing plant by (companyId, name)
    const existing = await prisma.plant.findUnique({
      where: { companyId_name: { companyId, name: p.name } },
    });
    const data = {
      companyId,
      name: p.name,
      ccaa: p.ccaa,
      province: p.province ?? null,
      city: p.city ?? null,
      status: p.status,
      specialty: p.specialty ?? null,
      employees: p.employees ?? null,
      parcelaM2: p.parcelaM2 ?? null,
      naveM2: p.naveM2 ?? null,
      closureYear: p.closureYear ?? null,
      investmentMEur: p.investmentMEur ?? null,
      notes: p.notes ?? null,
    };
    const row = existing
      ? await prisma.plant.update({ where: { id: existing.id }, data })
      : await prisma.plant.create({ data });
    plantIdByCompanyAndName.set(`${p.companySlug}::${p.name}`, row.id);
  }
  console.log(`  ✓ ${plantIdByCompanyAndName.size} plants upserted`);

  // ───────────────────────────────────────────────────────
  // 3. PLANT CONTACTS
  // ───────────────────────────────────────────────────────
  console.log(`▶ PlantContacts (${seed.plantContacts.length})…`);
  let contactCount = 0;
  for (const c of seed.plantContacts) {
    const companyId = companyIdBySlug.get(c.companySlug);
    const plantId = plantIdByCompanyAndName.get(`${c.companySlug}::${c.plantName}`);
    if (!companyId) continue;
    // Idempotencia: buscar por (companyId, fullName, role) — Prisma sin índice unique compuesto,
    // usamos findFirst. Si existe, update; si no, create.
    const existing = await prisma.plantContact.findFirst({
      where: { companyId, fullName: c.fullName, role: c.role },
    });
    const data = {
      companyId,
      plantId: plantId ?? null,
      fullName: c.fullName,
      role: c.role,
      roleCategory: c.roleCategory ?? null,
      linkedinUrl: c.linkedinUrl ?? null,
      email: c.email ?? null,
      sourceUrl: c.sourceUrl ?? null,
      sourceOutlet: c.sourceOutlet ?? null,
      confidence: c.confidence ?? 0.7,
      notes: c.notes ?? null,
      lastEnrichedAt: new Date(),
    };
    if (existing) {
      // En v6, `PlantContact.plantId` es opcional pero Prisma.UpdateInput
      // no acepta `null` explícito (usa `StringFieldUpdateOperationsInput`
      // o `undefined` para "no tocar"). El casteo a `UncheckedUpdateInput`
      // mantiene la semántica original: si plantId es null, el row conserva
      // su valor previo (no se borra la asignación).
      await prisma.plantContact.update({
        where: { id: existing.id },
        data: data as Prisma.PlantContactUncheckedUpdateInput,
      });
    } else {
      // Validate FK: plantId must point to a real plant or be null
      if (plantId) {
        await prisma.plantContact.create({ data: data as Prisma.PlantContactUncheckedCreateInput });
      } else {
        const { plantId: _drop, ...dataNoPlant } = data;
        await prisma.plantContact.create({ data: dataNoPlant as Prisma.PlantContactUncheckedCreateInput });
      }
    }
    contactCount++;
  }
  console.log(`  ✓ ${contactCount} contacts upserted`);

  // ───────────────────────────────────────────────────────
  // 4. TECHNICAL INVENTORY
  // ───────────────────────────────────────────────────────
  console.log(`▶ TechnicalInventory (${seed.technicalInventory.length})…`);
  let invCount = 0;
  let invSkipped = 0;
  for (const it of seed.technicalInventory) {
    const companyId = companyIdBySlug.get(it.companySlug);
    const plantId = plantIdByCompanyAndName.get(`${it.companySlug}::${it.plantName}`);
    if (!companyId) {
      invSkipped++;
      continue;
    }
    // Si la planta referenciada no existe en DB (p.ej. plantas europeas futuras),
    // no podemos crear el inventory porque plantId es FK requerida → skip
    if (!plantId) {
      invSkipped++;
      continue;
    }
    // Match por (plantId, category, specs) para idempotencia
    const existing = await prisma.technicalInventory.findFirst({
      where: {
        plantId,
        category: it.category,
        specs: it.specs ?? undefined,
      },
    });
    const data = {
      plantId,
      category: it.category,
      brand: it.brand ?? null,
      model: it.model ?? null,
      specs: it.specs ?? null,
      quantity: it.quantity ?? null,
      status: it.status,
      releaseWindow: it.releaseWindow ?? null,
      estimatedValueEur: it.estimatedValueEur ?? null,
      notes: it.notes ?? null,
    };
    if (existing) {
      await prisma.technicalInventory.update({ where: { id: existing.id }, data });
    } else {
      await prisma.technicalInventory.create({ data });
    }
    invCount++;
  }
  console.log(`  ✓ ${invCount} inventory items upserted (${invSkipped} skipped — planta no en DB)`);

  // ───────────────────────────────────────────────────────
  // 5. OPERATIONS
  // ───────────────────────────────────────────────────────
  console.log(`▶ Operations (${seed.operations.length})…`);
  let opCount = 0;
  for (const op of seed.operations) {
    const companyId = companyIdBySlug.get(op.companySlug);
    if (!companyId) continue;
    const existing = await prisma.operation.findFirst({
      where: { companyId, title: op.title, type: op.type },
    });
    const data = {
      companyId,
      type: op.type,
      title: op.title,
      description: op.description ?? null,
      amountMeur: op.amountMeur ?? null,
      jobsAffected: op.jobsAffected ?? null,
      announcedAt: new Date(op.announcedAt),
      status: op.status ?? 'announced',
      confidence: op.confidence ?? 0.7,
      sourceUrl: op.sourceUrl ?? null,
      sourceOutlet: op.sourceOutlet ?? null,
    };
    if (existing) {
      await prisma.operation.update({ where: { id: existing.id }, data });
    } else {
      await prisma.operation.create({ data });
    }
    opCount++;
  }
  console.log(`  ✓ ${opCount} operations upserted`);

  // ───────────────────────────────────────────────────────
  // 6. TIMELINE EVENTS
  // ───────────────────────────────────────────────────────
  console.log(`▶ TimelineEvents (${seed.timelineEvents.length})…`);
  let evCount = 0;
  for (const ev of seed.timelineEvents) {
    const companyId = companyIdBySlug.get(ev.companySlug);
    if (!companyId) continue;
    const plantId = ev.plantName
      ? plantIdByCompanyAndName.get(`${ev.companySlug}::${ev.plantName}`) ?? null
      : null;
    const existing = await prisma.timelineEvent.findFirst({
      where: { companyId, date: new Date(ev.date), title: ev.title },
    });
    const data = {
      companyId,
      plantId,
      date: new Date(ev.date),
      title: ev.title,
      sourceUrl: ev.sourceUrl ?? null,
      sourceOutlet: ev.sourceOutlet ?? null,
    };
    if (existing) {
      await prisma.timelineEvent.update({ where: { id: existing.id }, data });
    } else {
      await prisma.timelineEvent.create({ data });
    }
    evCount++;
  }
  console.log(`  ✓ ${evCount} timeline events upserted`);

  // ───────────────────────────────────────────────────────
  // 7. FINANCIALS
  // ───────────────────────────────────────────────────────
  console.log(`▶ Financials (${seed.financials.length})…`);
  let finCount = 0;
  for (const f of seed.financials) {
    const companyId = companyIdBySlug.get(f.companySlug);
    if (!companyId) continue;
    const existing = await prisma.financial.findFirst({
      where: { companyId, year: f.year, concept: f.concept },
    });
    const data = {
      companyId,
      year: f.year,
      concept: f.concept,
      amountMeur: f.amountMeur,
      category: f.category ?? null,
      sourceUrl: f.sourceUrl ?? null,
      notes: f.notes ?? null,
    };
    if (existing) {
      await prisma.financial.update({ where: { id: existing.id }, data });
    } else {
      await prisma.financial.create({ data });
    }
    finCount++;
  }
  console.log(`  ✓ ${finCount} financials upserted`);

  // ───────────────────────────────────────────────────────
  // 8. SOURCES
  // ───────────────────────────────────────────────────────
  console.log(`▶ Sources (${seed.sources.length})…`);
  let srcCount = 0;
  for (const s of seed.sources) {
    const companyId = companyIdBySlug.get(s.companySlug);
    if (!companyId) continue;
    const data = {
      companyId,
      url: s.url,
      title: s.title,
      outlet: s.outlet,
      outletType: s.outletType,
      language: s.language ?? 'es',
      deimplantationSignal: s.deimplantationSignal ?? false,
      publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
    };
    await prisma.source.upsert({
      where: { url: s.url },
      create: data,
      update: data,
    });
    srcCount++;
  }
  console.log(`  ✓ ${srcCount} sources upserted`);

  // ───────────────────────────────────────────────────────
  // 9. AUCTION CHECKS
  // ───────────────────────────────────────────────────────
  console.log(`▶ AuctionChecks (${seed.auctionChecks.length})…`);
  let acCount = 0;
  for (const a of seed.auctionChecks) {
    const companyId = companyIdBySlug.get(a.companySlug);
    if (!companyId) continue;
    // Idempotencia por (companyId, platform, checkedAt-day)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existing = await prisma.auctionCheck.findFirst({
      where: { companyId, platform: a.platform, checkedAt: { gte: startOfDay } },
    });
    const data = {
      companyId,
      companyName: a.companyName,
      platform: a.platform,
      result: a.result,
      details: a.details ?? null,
    };
    if (existing) {
      await prisma.auctionCheck.update({ where: { id: existing.id }, data });
    } else {
      await prisma.auctionCheck.create({ data });
    }
    acCount++;
  }
  console.log(`  ✓ ${acCount} auction checks upserted`);

  // ───────────────────────────────────────────────────────
  // RESUMEN FINAL
  // ───────────────────────────────────────────────────────
  const finalCounts = await prisma.$transaction([
    prisma.company.count(),
    prisma.plant.count(),
    prisma.plantContact.count(),
    prisma.technicalInventory.count(),
    prisma.operation.count(),
    prisma.timelineEvent.count(),
    prisma.financial.count(),
    prisma.source.count(),
    prisma.auctionCheck.count(),
  ]);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✓ SEED v6 COMPLETADO — counts en DB:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Company:            ${finalCounts[0]}`);
  console.log(`  Plant:              ${finalCounts[1]}`);
  console.log(`  PlantContact:       ${finalCounts[2]}`);
  console.log(`  TechnicalInventory: ${finalCounts[3]}`);
  console.log(`  Operation:          ${finalCounts[4]}`);
  console.log(`  TimelineEvent:      ${finalCounts[5]}`);
  console.log(`  Financial:          ${finalCounts[6]}`);
  console.log(`  Source:             ${finalCounts[7]}`);
  console.log(`  AuctionCheck:       ${finalCounts[8]}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('✗ SEED v6 FALLÓ:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
