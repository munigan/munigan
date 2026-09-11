import { TrainerExperiment } from "@/features/raid-trainer/TrainerExperiment";

export const metadata = {
  title: "Raid Trainer · Defile Experiment",
  robots: { index: false, follow: false },
};

export default function RaidTrainerPage() {
  return <TrainerExperiment />;
}
