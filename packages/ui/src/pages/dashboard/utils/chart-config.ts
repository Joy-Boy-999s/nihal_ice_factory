import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { font: { size: 12 }, color: '#64748b' },
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 10,
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b' } },
    y: { grid: { color: '#e5e7eb' }, ticks: { color: '#64748b' } },
  },
} as const;

export const barOptions: ChartOptions<'bar'> = baseOptions;
export const lineOptions: ChartOptions<'line'> = baseOptions;
