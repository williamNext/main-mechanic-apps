import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCheck,
  Wrench,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/use-auth';

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { label: 'Painel', href: '/(admin)/dashboard', icon: LayoutDashboard },
  { label: 'Aprovações', href: '/(admin)/approvals', icon: UserCheck },
  { label: 'Mecânicos', href: '/(admin)/mechanics', icon: Wrench },
  { label: 'Agendamentos', href: '/(admin)/appointments', icon: CalendarDays },
  { label: 'Financeiro', href: '/(admin)/finance', icon: CircleDollarSign },
  { label: 'Relatórios', href: '/(admin)/reports', icon: BarChart3 },
  { label: 'Configurações', href: '/(admin)/settings', icon: Settings },
];

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();
  const desktop = width >= 900;

  const go = (href: string) => {
    router.push(href as never);
  };

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.root}>
      {desktop ? (
        <View style={styles.sidebar}>
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}>
              <CheckCircle2 size={18} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.brandTitle}>Administração da Oficina</Text>
              <Text style={styles.brandMeta}>Operações</Text>
            </View>
          </View>

          <View style={styles.navList}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.includes(item.href.replace('/(admin)', ''));
              return (
                <Pressable
                  key={item.href}
                  onPress={() => go(item.href)}
                  style={[styles.navItem, active && styles.navItemActive]}
                >
                  <Icon size={18} color={active ? '#101828' : '#667085'} />
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.accountBlock}>
            <Text style={styles.accountName} numberOfLines={1}>
              {user?.name ?? 'Administrador'}
            </Text>
            <Text style={styles.accountMeta} numberOfLines={1}>
              {user?.email ?? 'Sem email'}
            </Text>
            <Pressable onPress={onLogout} style={styles.logoutButton}>
              <LogOut size={16} color="#b42318" />
              <Text style={styles.logoutText}>Sair</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.contentArea}>
        <View style={styles.topbar}>
          <Text style={styles.pageTitle}>{title}</Text>
          {!desktop ? (
            <Pressable onPress={onLogout} style={styles.mobileLogout}>
              <LogOut size={17} color="#b42318" />
            </Pressable>
          ) : null}
        </View>

        {!desktop ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mobileNav}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.includes(item.href.replace('/(admin)', ''));
              return (
                <Pressable
                  key={item.href}
                  onPress={() => go(item.href)}
                  style={[styles.mobileNavItem, active && styles.mobileNavItemActive]}
                >
                  <Icon size={16} color={active ? '#101828' : '#667085'} />
                  <Text style={[styles.mobileNavText, active && styles.navTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scrollContent}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f7f8fa',
  },
  sidebar: {
    width: 268,
    borderRightWidth: 1,
    borderRightColor: '#eaecf0',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 20,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101828',
  },
  brandTitle: {
    color: '#101828',
    fontSize: 15,
    fontWeight: '800',
  },
  brandMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
  navList: {
    gap: 6,
    flex: 1,
  },
  navItem: {
    minHeight: 42,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  navItemActive: {
    backgroundColor: '#f2f4f7',
  },
  navText: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '700',
  },
  navTextActive: {
    color: '#101828',
  },
  accountBlock: {
    borderTopWidth: 1,
    borderTopColor: '#eaecf0',
    paddingTop: 14,
    gap: 6,
  },
  accountName: {
    color: '#101828',
    fontSize: 14,
    fontWeight: '800',
  },
  accountMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 8,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#b42318',
    fontSize: 13,
    fontWeight: '800',
  },
  contentArea: {
    flex: 1,
  },
  topbar: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: '#eaecf0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    color: '#101828',
    fontSize: 22,
    fontWeight: '800',
  },
  mobileLogout: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f3',
  },
  mobileNav: {
    maxHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: '#eaecf0',
    backgroundColor: '#ffffff',
  },
  mobileNavItem: {
    height: 42,
    marginTop: 8,
    marginLeft: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileNavItemActive: {
    backgroundColor: '#f2f4f7',
  },
  mobileNavText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 24,
    gap: 18,
  },
});
