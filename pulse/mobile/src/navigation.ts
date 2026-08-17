import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Training:
    | {
        memberId?: string;
        stampId?: string;
        locationId?: string;
        autoStart?: boolean;
        memberName?: string;
      }
    | undefined;
  Calendar: undefined;
  Member: undefined;
  Packages: undefined;
  Attendance: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Scan: {
    purpose?: 'attendance' | 'end' | 'coachStamp';
    memberPackageId?: string;
    stampIndex?: number;
    locationId?: string;
    memberId?: string;
    memberName?: string;
  };
  MemberStamps: {
    memberId: string;
    memberName: string;
  };
};
