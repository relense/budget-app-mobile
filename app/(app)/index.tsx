import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useBankBalance,
  useCategoryMonths,
  useCurrentMonth,
  useRecurringExpenses,
  useTransactions,
} from '../../src/api/budgetHomeQueries';
import { useAuth } from '../../src/auth/AuthContext';
import { AddRow } from '../../src/components/AddRow';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ListRow } from '../../src/components/ListRow';
import { RetryableError } from '../../src/components/RetryableError';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import {
  mostRecentDate,
  sumActualCents,
  sumAvailableBudgetedCents,
  sumRecurringCents,
} from '../../src/lib/budgetHomeCalculations';
import { formatCents } from '../../src/lib/formatCents';
import { formatDate, formatMonthLabel } from '../../src/lib/formatDate';
import { useTheme } from '../../src/theme/ThemeProvider';

type Tab = 'AVAILABLE' | 'EXPENSES' | 'RECURRENT' | 'INCOME';
type HeaderMetric =
  'AVAILABLE_BUDGETED' | 'TOTAL_EXPENSES' | 'TOTAL_RECURRENT' | 'TOTAL_INCOME' | 'TOTAL_BALANCE';

const TABS: { key: Tab; label: string }[] = [
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'EXPENSES', label: 'Expenses' },
  { key: 'RECURRENT', label: 'Recurrent' },
  { key: 'INCOME', label: 'Income' },
];

const HEADER_METRIC_LABELS: Record<HeaderMetric, string> = {
  AVAILABLE_BUDGETED: 'Available Budgeted',
  TOTAL_EXPENSES: 'Total Expenses',
  TOTAL_RECURRENT: 'Total Recurrent',
  TOTAL_INCOME: 'Total Income',
  TOTAL_BALANCE: 'Total Balance',
};

const HEADER_METRIC_ORDER: HeaderMetric[] = [
  'AVAILABLE_BUDGETED',
  'TOTAL_EXPENSES',
  'TOTAL_RECURRENT',
  'TOTAL_INCOME',
  'TOTAL_BALANCE',
];

// One distinct string per failing query, not a single shared message -- so the message on
// screen tells you which fetch actually failed instead of just "something went wrong".
const MONTH_LOAD_ERROR = "Couldn't load your budget for this month.";
const TAB_LOAD_ERRORS: Record<Tab, string> = {
  AVAILABLE: "Couldn't load your budget categories.",
  EXPENSES: "Couldn't load your transactions.",
  RECURRENT: "Couldn't load your recurring expenses.",
  INCOME: "Couldn't load your income.",
};

// Bottom nav is drawn for visual completeness (matches the mockups) but isn't real navigation
// yet -- only this screen was in scope for this pass, see docs/PROGRESS-MOBILE.md.
const BOTTOM_NAV_ICONS = [
  'home',
  'credit-card-outline',
  'plus-box-outline',
  'bank',
  'account-circle',
] as const;

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const navigation = useNavigation();

  const [tab, setTab] = useState<Tab>('AVAILABLE');
  const [headerMetric, setHeaderMetric] = useState<HeaderMetric>('AVAILABLE_BUDGETED');
  const [metricMenuOpen, setMetricMenuOpen] = useState(false);
  // Bumped on every screen focus (e.g. coming back from the edit-category modal) and folded
  // into each row's key below, so a row left swiped-open resets to closed instantly on remount
  // instead of via an animated close that could be seen racing the screen transition.
  const [listResetKey, setListResetKey] = useState(0);

  useEffect(() => {
    return navigation.addListener('focus', () => setListResetKey((key) => key + 1));
  }, [navigation]);

  const currentMonthQuery = useCurrentMonth();
  const month = currentMonthQuery.data?.month;

  const expenseCategoryMonths = useCategoryMonths(month, 'EXPENSE');
  const incomeCategoryMonths = useCategoryMonths(month, 'INCOME');
  const recurringExpenses = useRecurringExpenses(month);
  const transactionsQuery = useTransactions(month);
  const bankBalance = useBankBalance();

  const expenseTransactions = (transactionsQuery.data ?? []).filter(
    (t) => t.direction === 'EXPENSE',
  );

  const headerAmountCents = (() => {
    switch (headerMetric) {
      case 'AVAILABLE_BUDGETED':
        return expenseCategoryMonths.data
          ? sumAvailableBudgetedCents(expenseCategoryMonths.data)
          : 0;
      case 'TOTAL_EXPENSES':
        return expenseCategoryMonths.data ? sumActualCents(expenseCategoryMonths.data) : 0;
      case 'TOTAL_RECURRENT':
        return recurringExpenses.data ? sumRecurringCents(recurringExpenses.data) : 0;
      case 'TOTAL_INCOME':
        return incomeCategoryMonths.data ? sumActualCents(incomeCategoryMonths.data) : 0;
      case 'TOTAL_BALANCE':
        return bankBalance.data?.amountCents ?? 0;
    }
  })();

  // Whichever query backs the currently-selected header metric -- used so the header shows a
  // spinner/error state instead of a real-looking "€0.00" while that data hasn't loaded yet.
  const headerQuery =
    headerMetric === 'TOTAL_RECURRENT'
      ? recurringExpenses
      : headerMetric === 'TOTAL_INCOME'
        ? incomeCategoryMonths
        : headerMetric === 'TOTAL_BALANCE'
          ? bankBalance
          : expenseCategoryMonths;

  const activeQuery =
    tab === 'AVAILABLE'
      ? expenseCategoryMonths
      : tab === 'EXPENSES'
        ? transactionsQuery
        : tab === 'RECURRENT'
          ? recurringExpenses
          : incomeCategoryMonths;

  function renderRows() {
    if (tab === 'AVAILABLE') {
      return (expenseCategoryMonths.data ?? []).map((cm) => (
        <SwipeableRow
          key={`${cm.id}-${listResetKey}`}
          testID={`swipe-edit-action-${cm.id}`}
          onEdit={() =>
            router.push({
              pathname: '/edit-category',
              params: {
                categoryMonthId: cm.id,
                categoryId: cm.category.id,
                name: cm.category.name,
                icon: cm.category.icon,
                color: cm.category.color,
                budgetType: cm.category.budgetType ?? '',
                direction: cm.category.direction,
                monthlyBudgetCents: String(cm.monthlyBudgetCents),
              },
            })
          }
        >
          <ListRow
            icon={<CategoryIcon name={cm.category.icon} color={colors.text.primary} />}
            circleColor={cm.category.color}
            title={cm.category.name}
            // The spent (headline) vs. budget (gray, secondary) figures already make an
            // over-budget category obvious at a glance -- no separate "Overspent" state needed.
            subtitle="Budget"
            amountText={formatCents(cm.actualAmountCents)}
            secondaryAmountText={formatCents(cm.monthlyBudgetCents)}
          />
        </SwipeableRow>
      ));
    }
    if (tab === 'EXPENSES') {
      return expenseTransactions.map((t) => (
        <SwipeableRow
          key={`${t.id}-${listResetKey}`}
          testID={`swipe-edit-action-${t.id}`}
          onEdit={() =>
            router.push({
              pathname: '/edit-transaction',
              params: {
                transactionId: t.id,
                categoryMonthId: t.categoryMonth.id,
                amountCents: String(t.amountCents),
                date: t.date,
                merchant: t.merchant ?? '',
              },
            })
          }
        >
          <ListRow
            icon={<CategoryIcon name={t.categoryMonth.category.icon} color={colors.text.primary} />}
            circleColor={t.categoryMonth.category.color}
            title={t.merchant ?? t.categoryMonth.category.name}
            subtitle={formatDate(t.date)}
            amountText={formatCents(t.amountCents)}
          />
        </SwipeableRow>
      ));
    }
    if (tab === 'RECURRENT') {
      return (recurringExpenses.data ?? []).map((re) => {
        const date = mostRecentDate(re.transactions);
        return (
          <SwipeableRow
            key={`${re.id}-${listResetKey}`}
            testID={`swipe-edit-action-${re.id}`}
            onEdit={() =>
              router.push({
                pathname: '/edit-recurring-expense',
                params: {
                  recurringExpenseId: re.id,
                  name: re.name,
                  amountCents: String(re.amountCents),
                  categoryId: re.category.id,
                  categoryIcon: re.category.icon,
                  categoryColor: re.category.color,
                  budgetType: re.budgetType,
                  dueDay: String(re.dueDay),
                  paidThisMonth: String(re.paidThisMonth),
                  transactionIds: JSON.stringify(re.transactions.map((t) => t.id)),
                },
              })
            }
          >
            <ListRow
              icon={
                re.paidThisMonth ? (
                  <MaterialCommunityIcons name="check" size={20} color={colors.status.paid.text} />
                ) : (
                  <CategoryIcon name={re.category.icon} color={colors.text.primary} />
                )
              }
              circleColor={re.paidThisMonth ? colors.status.paid.background : re.category.color}
              title={re.name}
              subtitle={re.paidThisMonth ? (date ? formatDate(date) : 'Paid') : 'Unpaid'}
              amountText={formatCents(re.amountCents)}
            />
          </SwipeableRow>
        );
      });
    }
    // INCOME
    return (incomeCategoryMonths.data ?? []).map((cm) => {
      const date = mostRecentDate(cm.transactions);
      return (
        <SwipeableRow
          key={`${cm.id}-${listResetKey}`}
          testID={`swipe-edit-action-${cm.id}`}
          onEdit={() =>
            router.push({
              pathname: '/edit-category',
              params: {
                categoryMonthId: cm.id,
                categoryId: cm.category.id,
                name: cm.category.name,
                icon: cm.category.icon,
                color: cm.category.color,
                budgetType: cm.category.budgetType ?? '',
                direction: cm.category.direction,
                monthlyBudgetCents: String(cm.monthlyBudgetCents),
              },
            })
          }
        >
          <Pressable
            testID={`income-row-${cm.id}`}
            onPress={() =>
              router.push({
                pathname: '/income-received',
                params: {
                  categoryMonthId: cm.id,
                  name: cm.category.name,
                  icon: cm.category.icon,
                  color: cm.category.color,
                  monthlyBudgetCents: String(cm.monthlyBudgetCents),
                  actualAmountCents: String(cm.actualAmountCents),
                  transactionIds: JSON.stringify(cm.transactions.map((t) => t.id)),
                },
              })
            }
          >
            <ListRow
              icon={<CategoryIcon name={cm.category.icon} color={colors.text.primary} />}
              circleColor={cm.category.color}
              title={cm.category.name}
              subtitle={date ? formatDate(date) : undefined}
              amountText={formatCents(cm.actualAmountCents)}
              secondaryAmountText={formatCents(cm.monthlyBudgetCents)}
            />
          </Pressable>
        </SwipeableRow>
      );
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
      <View style={{ paddingTop: insets.top + 16 }}>
        {currentMonthQuery.isLoading || headerQuery.isLoading ? (
          <ActivityIndicator
            testID="header-amount-spinner"
            style={styles.headerSpinner}
            color={colors.text.primary}
          />
        ) : currentMonthQuery.isError || headerQuery.isError ? (
          <Pressable
            testID="header-amount-retry"
            onPress={() => {
              currentMonthQuery.refetch();
              // headerQuery is one of expenseCategoryMonths/recurringExpenses/
              // incomeCategoryMonths (gated on `month` being known) or bankBalance (never
              // month-gated) depending on headerMetric -- only refetch it if it's actually
              // enabled right now.
              if (month || headerMetric === 'TOTAL_BALANCE') headerQuery.refetch();
            }}
          >
            <Text
              testID="header-amount-error"
              style={[styles.headerAmount, { color: colors.button.deleteBackground }]}
            >
              —
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.headerAmount, { color: colors.text.primary }]}>
            {formatCents(headerAmountCents)}
          </Text>
        )}
        <Pressable style={styles.headerLabelRow} onPress={() => setMetricMenuOpen((open) => !open)}>
          <Text style={[styles.headerLabel, { color: colors.text.secondary }]}>
            {HEADER_METRIC_LABELS[headerMetric]}
          </Text>
          <MaterialCommunityIcons
            name={metricMenuOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.text.secondary}
          />
        </Pressable>

        <View style={[styles.tabRow, { backgroundColor: colors.segment.track }]}>
          {TABS.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.tabButton, tab === key && { backgroundColor: colors.segment.active }]}
              onPress={() => setTab(key)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: tab === key ? colors.segment.activeText : colors.segment.inactiveText },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {month ? (
          <Text style={[styles.monthLabel, { color: colors.text.secondary }]}>
            {formatMonthLabel(month)}
          </Text>
        ) : null}
      </View>

      {metricMenuOpen ? (
        <>
          {/* Full-screen backdrop (sibling of the header, so it covers the whole screen, not
              just the header area) so tapping anywhere outside the menu dismisses it, instead
              of forcing the user to pick one of the options. Sits below the menu itself in
              z-order (zIndex 9 vs. 10) so menu-item taps still land on them, not this. */}
          <Pressable
            testID="header-metric-menu-backdrop"
            style={[StyleSheet.absoluteFill, styles.metricMenuBackdrop]}
            onPress={() => setMetricMenuOpen(false)}
          />
          <View
            style={[
              styles.metricMenu,
              { backgroundColor: colors.background.screen, borderColor: colors.segment.track },
            ]}
          >
            {HEADER_METRIC_ORDER.filter((m) => m !== headerMetric).map((m) => (
              <Pressable
                key={m}
                style={styles.metricMenuItem}
                onPress={() => {
                  setHeaderMetric(m);
                  setMetricMenuOpen(false);
                }}
              >
                <Text style={{ color: colors.text.primary }}>{HEADER_METRIC_LABELS[m]}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <ScrollView contentContainerStyle={styles.listContent}>
        {tab === 'AVAILABLE' ? (
          <AddRow label="New Category" onPress={() => router.push('/add-category')} />
        ) : null}
        {tab === 'RECURRENT' ? (
          <AddRow label="New recurrent expense" onPress={() => router.push('/add-recurring-expense')} />
        ) : null}
        {tab === 'INCOME' ? (
          <AddRow label="New income" onPress={() => router.push('/add-income')} />
        ) : null}

        {/* Every tab body query is gated on `month` being known (`enabled: !!month` in
            budgetHomeQueries.ts), so while currentMonth is loading or failed, activeQuery is
            just idle (isLoading: false, isError: false, react-query v5 semantics) -- checked
            explicitly here first, otherwise a slow/failed currentMonth fetch would show an
            empty list with no spinner and no error. */}
        {currentMonthQuery.isLoading || activeQuery.isLoading ? (
          <ActivityIndicator
            testID="home-body-spinner"
            style={styles.spinner}
            color={colors.text.primary}
          />
        ) : currentMonthQuery.isError ? (
          <RetryableError
            testID="home-body-error"
            style={styles.spinner}
            message={MONTH_LOAD_ERROR}
            onRetry={() => currentMonthQuery.refetch()}
          />
        ) : activeQuery.isError ? (
          <RetryableError
            testID="home-body-error"
            style={styles.spinner}
            message={TAB_LOAD_ERRORS[tab]}
            onRetry={() => activeQuery.refetch()}
          />
        ) : (
          renderRows()
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        {BOTTOM_NAV_ICONS.map((iconName, i) => {
          const icon = (
            <MaterialCommunityIcons
              name={iconName}
              size={26}
              color={i === 1 ? colors.navigation.activeIcon : colors.navigation.inactiveIcon}
            />
          );
          if (i === 2) {
            return (
              <Pressable
                key={iconName}
                testID="add-transaction-button"
                onPress={() => router.push('/add-transaction')}
              >
                {icon}
              </Pressable>
            );
          }
          // Profile screen doesn't exist yet -- temporarily wired to sign out instead of
          // being fully inert, so there's still a way to log out until it's built.
          return i === 4 ? (
            <Pressable key={iconName} testID="sign-out-button" onPress={signOut}>
              {icon}
            </Pressable>
          ) : (
            <View key={iconName}>{icon}</View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAmount: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpinner: {
    marginVertical: 6,
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerLabel: {
    fontSize: 13,
  },
  metricMenuBackdrop: {
    zIndex: 9,
  },
  metricMenu: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    zIndex: 10,
    elevation: 4,
  },
  metricMenuItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 20,
    marginHorizontal: 24,
    marginTop: 20,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  monthLabel: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  spinner: {
    marginTop: 24,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDEDED',
  },
});
