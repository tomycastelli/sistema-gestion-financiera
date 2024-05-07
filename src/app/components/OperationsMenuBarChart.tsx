"use client";

import moment from "moment";
import { type FC } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { type RouterOutputs } from "~/trpc/shared";

interface OperationsMenuBarChartProps {
  data: RouterOutputs["operations"]["userUploaded"]["monthCount"];
}

const OperationsMenuBarChart: FC<OperationsMenuBarChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart
        data={data.map((item) => ({
          day: moment(item.day).format("DD-MM"),
          operationsCount: Number(item.operationsCount),
          transactionsCount: Number(item.transactionsCount),
        }))}
      >
        <Bar name="Operaciones" dataKey="operationsCount" fill="#8884d8" />
        <Bar name="Transacciones" dataKey="transactionsCount" fill="#3662E3" />
        <XAxis dataKey="day" />
        <Legend verticalAlign="bottom" iconType="circle" />
        <Tooltip isAnimationActive={true} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default OperationsMenuBarChart;
