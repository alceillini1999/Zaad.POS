const router = require('express').Router();
const auth = require('../middlewares/auth');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');

router.get('/overview', auth, async (_req, res) => {
  const [salesAgg] = await Sale.aggregate([{ $group: { _id: null, totalSales: { $sum: '$total' }, totalProfit: { $sum: '$profit' } } }]);
  const [expAgg]   = await Expense.aggregate([{ $group: { _id: null, totalExp: { $sum: '$amount' } } }]);

  const totalSales    = salesAgg?.totalSales  || 0;
  const totalProfit   = salesAgg?.totalProfit || 0;
  const totalExpenses = expAgg?.totalExp      || 0;
  const netProfit     = totalProfit - totalExpenses;

  res.json({ totalSales, totalExpenses, netProfit });
});

module.exports = router;
