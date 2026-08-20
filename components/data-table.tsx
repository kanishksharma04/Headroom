import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  className?: string;
  /** Key of the row currently showing its expanded content, if any. */
  expandedRowKey?: string | null;
  /** Renders the full-width content shown directly below the expanded row. */
  renderExpandedRow?: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No records yet.",
  className,
  expandedRowKey = null,
  renderExpandedRow,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyMessage}</p>;
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(column.align === "right" && "text-right")}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const rowKey = getRowKey(row);
          const isExpanded = renderExpandedRow != null && rowKey === expandedRowKey;
          return (
            <Fragment key={rowKey}>
              <TableRow className={cn(isExpanded && "bg-muted/40")}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.align === "right" && "text-right tabular-nums")}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
              {isExpanded ? (
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={columns.length} className="pt-0 pb-6">
                    {renderExpandedRow!(row)}
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
