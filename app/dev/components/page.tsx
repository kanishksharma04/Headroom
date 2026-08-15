import type { ReactNode } from "react";
import { Money } from "@/components/money";
import { BigNumber } from "@/components/big-number";
import { StatCard } from "@/components/stat-card";
import { BreakdownRow } from "@/components/breakdown-row";
import { EmptyState } from "@/components/empty-state";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b pb-10">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

type SampleRow = { id: string; name: string; type: string; amount: string };

const sampleRows: SampleRow[] = [
  { id: "1", name: "HDFC Savings", type: "Savings", amount: "184230" },
  { id: "2", name: "Home Loan EMI", type: "Liability", amount: "-38450" },
  { id: "3", name: "PPF", type: "Asset", amount: "620000" },
];

const columns: DataTableColumn<SampleRow>[] = [
  { key: "name", header: "Name", render: (row) => row.name },
  { key: "type", header: "Type", render: (row) => row.type },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    render: (row) => <Money value={row.amount} colorize />,
  },
];

export default function ComponentGalleryPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Component gallery</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Internal reference for Headroom&apos;s design primitives.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Money">
        <div className="flex flex-col gap-2">
          <Money value="120000" className="text-lg" />
          <Money value="1234567" className="text-lg" />
          <Money value="99999" className="text-lg" />
        </div>
        <p className="text-muted-foreground text-sm">
          Tabular numerals keep the digits above aligned in a column even as the value
          changes.
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span>
            Negative, colourised: <Money value="-42300" colorize />
          </span>
          <span>
            With decimals: <Money value="42300.5" decimals={2} />
          </span>
          <span>
            Signed positive: <Money value="5000" showSign />
          </span>
        </div>
      </Section>

      <Section title="Money — shorthand">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span>
            ₹38,40,000 → <Money value="3840000" shorthand />
          </span>
          <span>
            ₹1,20,00,000 → <Money value="12000000" shorthand />
          </span>
          <span>
            Below one lakh, no shorthand → <Money value="99999" shorthand />
          </span>
        </div>
      </Section>

      <Section title="Big number">
        <BigNumber value="42300" caption="Yours to spend before 5 Sep" />
      </Section>

      <Section title="Stat card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Net worth" value={<Money value="4820000" shorthand />} />
          <StatCard
            label="Savings rate"
            value="27%"
            delta={<Money value="-500" showSign colorize />}
          />
          <StatCard
            label="Emergency fund"
            value="4.2 months"
            delta="Target: 6 months"
          />
        </div>
      </Section>

      <Section title="Breakdown row">
        <div className="divide-y">
          <BreakdownRow label="Salary" amount="120000" date={new Date("2026-08-25")} />
          <BreakdownRow
            label="Credit card"
            amount="-18000"
            date={new Date("2026-08-20")}
            detail="Statement balance as of 15 Aug, due 20 Aug. Includes ₹4,200 of dining and ₹13,800 of other spend."
          />
          <BreakdownRow
            label="Rent"
            amount="-25000"
            date={new Date("2026-09-01")}
            detail="Fixed monthly commitment, unchanged since Jan 2026."
          />
        </div>
      </Section>

      <Section title="Empty state">
        <div className="rounded-lg border">
          <EmptyState
            title="No loans yet"
            description="Add a loan to see its amortisation schedule and run prepayment scenarios."
            action={<Button size="sm">Add a loan</Button>}
          />
        </div>
      </Section>

      <Section title="Data table">
        <DataTable columns={columns} rows={sampleRows} getRowKey={(row) => row.id} />
      </Section>
    </div>
  );
}
