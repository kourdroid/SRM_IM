import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

type Props = {
  data: { value: number; label: string; frontColor?: string }[];
  title: string;
};

export default function CustomBarChart({ data, title }: Props) {
  return (
    <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
      <Text className="text-lg font-bold text-gray-900 mb-4">{title}</Text>
      <View className="items-center">
        <BarChart
          data={data}
          barWidth={22}
          noOfSections={4}
          barBorderRadius={4}
          frontColor="#2563eb"
          yAxisThickness={0}
          xAxisThickness={0}
          hideRules
          isAnimated
        />
      </View>
    </View>
  );
}
