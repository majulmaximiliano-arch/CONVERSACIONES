import { ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { MessageChartData } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ChartRendererProps {
  data: MessageChartData;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ChartRenderer({ data }: ChartRendererProps) {
  if (!data || !data.type || !data.data || !Array.isArray(data.data)) {
    return <div className="p-4 text-sm text-muted-foreground bg-muted/50 rounded-lg">Datos de gráfico inválidos</div>;
  }

  const { type, title, xKey = "name", yKeys = ["value"], columns = [] } = data as any;
  const chartData = data.data;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => typeof v === 'number' && v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                itemStyle={{ color: "hsl(var(--popover-foreground))" }}
              />
              {yKeys.map((key: string, i: number) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              {yKeys.map((key: string, i: number) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 4, fill: COLORS[i % COLORS.length], strokeWidth: 0 }} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              {yKeys.map((key: string, i: number) => (
                <Area key={key} type="monotone" dataKey={key} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Pie data={chartData} dataKey={yKeys[0]} nameKey={xKey} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                {chartData.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'table':
        return (
          <div className="rounded-md border max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {columns.map((c: any) => (
                    <TableHead key={c.key} className="font-semibold">{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((row: any, i: number) => (
                  <TableRow key={i}>
                    {columns.map((c: any) => (
                      <TableCell key={c.key}>{row[c.key]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      default:
        return <div className="p-4 text-sm text-muted-foreground">Tipo de gráfico no soportado</div>;
    }
  };

  return (
    <div className="mt-4 bg-background border rounded-xl overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b bg-muted/20">
          <h4 className="font-medium text-sm text-foreground">{title}</h4>
        </div>
      )}
      <div className="p-4">
        {renderChart()}
      </div>
    </div>
  );
}
