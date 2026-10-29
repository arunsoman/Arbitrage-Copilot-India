import { NextResponse } from 'next/server';
import { getSessionUser, isDemoMode } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    demoMode: isDemoMode(),
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarColor: user.avatarColor,
          gstin: user.gstin,
          businessName: user.businessName,
          state: user.state,
          onboardingDone: user.onboardingDone,
          supplierProfile: user.supplierProfile
            ? {
                companyName: user.supplierProfile.companyName,
                city: user.supplierProfile.city,
                state: user.supplierProfile.state,
                pincode: user.supplierProfile.pincode,
                contactPhone: user.supplierProfile.contactPhone,
              }
            : null,
        }
      : null,
  });
}
