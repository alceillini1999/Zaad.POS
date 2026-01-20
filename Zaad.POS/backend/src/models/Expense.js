const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ExpenseSchema = new Schema({
  name:{type:String, required:true},
  category:String,
  amount:{type:Number, required:true},
  date:{type:Date, default:Date.now},
  notes:String,
  createdAt:{type:Date, default:Date.now}
});
module.exports = mongoose.model('Expense', ExpenseSchema);
