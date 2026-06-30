import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { colors } from '../theme/colors';

// Replace TEST_IDs with production ad unit IDs from AdMob console
const ANDROID_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

const IOS_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

const AD_UNIT_ID = Platform.OS === 'ios' ? IOS_AD_UNIT_ID : ANDROID_AD_UNIT_ID;

export default function AdBanner() {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
});
