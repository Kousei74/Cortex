import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BaseChart } from './base-chart';

export function ScatterWidget({ widget }) {
    // data_points is already [{x, y, id}, ...] from backend analysis logic
    // but ensure naming matches what recharts needs?
    // Backend provided: {x, y, id}

    return (
        <BaseChart widget={widget} data={widget.data_points}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="x" name="Confidence" unit="" tick={{ fontSize: 12 }} />
                <YAxis type="number" dataKey="y" name="Sentiment" unit="" tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name={widget.title} data={widget.data_points} fill="#8884d8" />
            </ScatterChart>
        </BaseChart>
    );
}
