import { prisma } from '../index';

function publicCard(card: any) {
  return {
    id: card.id,
    retailerName: card.retailerName,
    cardLast4: card.cardLast4,
    rewardsRate: card.rewardsRate,
    financingTerms: card.financingTerms,
    createdAt: card.createdAt,
  };
}

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true,
      cards: true,
      carts: {
        include: {
          items: {
            include: {
              product: { include: { retailerProducts: true } },
              matchResults: { include: { retailerProduct: true } },
            },
          },
          splitPlans: true,
          autoBuyRules: true,
        },
      },
      autoBuyRules: true,
      settlementLedgerEntries: { orderBy: { createdAt: 'desc' } },
      purchasedGiftCards: { orderBy: { createdAt: 'desc' } },
      auditEvents: { orderBy: { createdAt: 'desc' } },
      savedLists: {
        include: {
          items: { include: { product: true } },
          shares: true,
        },
      },
      savedListShares: {
        include: {
          list: true,
        },
      },
      alertSubscriptions: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!user) throw new Error('User not found');

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    preferences: user.preferences,
    cards: user.cards.map(publicCard),
    carts: user.carts,
    autoBuyRules: user.autoBuyRules,
    settlementLedgerEntries: user.settlementLedgerEntries,
    purchasedGiftCards: user.purchasedGiftCards.map((giftCard: any) => ({
      ...giftCard,
      encryptedCode: undefined,
      encryptedPin: undefined,
    })),
    savedLists: user.savedLists,
    savedListShares: user.savedListShares,
    alertSubscriptions: user.alertSubscriptions,
    auditEvents: user.auditEvents,
  };
}

export async function deleteUserData(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    await tx.matchResult.deleteMany({ where: { cartItem: { cart: { userId } } } });
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    await tx.splitPlan.deleteMany({ where: { cart: { userId } } });
    await tx.autoBuyRule.deleteMany({ where: { userId } });
    await tx.universalCart.deleteMany({ where: { userId } });
    await (tx as any).settlementLedgerEntry.deleteMany({ where: { userId } });
    await tx.virtualCardTransaction.deleteMany({ where: { userId } });
    await (tx as any).purchasedGiftCard.deleteMany({ where: { userId } });
    await tx.userPreferences.deleteMany({ where: { userId } });
    await tx.userCard.deleteMany({ where: { userId } });
    await tx.savedListItem.deleteMany({ where: { list: { userId } } });
    await tx.savedListShare.deleteMany({ where: { OR: [{ userId }, { list: { userId } }] } });
    await tx.savedList.deleteMany({ where: { userId } });
    await tx.alertSubscription.deleteMany({ where: { userId } });
    await tx.auditEvent.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });

    return { deletedUserId: userId };
  });
}
