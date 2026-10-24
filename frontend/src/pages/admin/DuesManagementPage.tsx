import DuesRegistry from '../../components/finance/DuesRegistry';

/**
 * The admin's dues management page (/admin/duesmanagement). It is separate from
 * the bursar's /bu/dues page, with its own tabs: Dues, Transactions and Revenue forecast.
 */
export default function DuesManagementPage() {
  return <DuesRegistry />;
}
