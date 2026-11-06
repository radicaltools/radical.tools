Attribute VB_Name = "modDb"
Option Explicit

Public Function OpenDb() As ADODB.Connection
    Dim cn As New ADODB.Connection
    cn.Open "Provider=SQLOLEDB;Data Source=SQL01;Initial Catalog=Billing;Integrated Security=SSPI"
    Set OpenDb = cn
End Function

Public Function UnpaidInvoices(cn As ADODB.Connection) As ADODB.Recordset
    Set UnpaidInvoices = cn.Execute("SELECT Id, Customer, Amount FROM Invoices WHERE PaidOn IS NULL")
End Function
