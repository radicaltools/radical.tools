VERSION 5.00
Begin VB.Form frmInvoice
   Caption         =   "Unpaid invoices"
End
Attribute VB_Name = "frmInvoice"
Private Sub Form_Load()
    Dim rs As ADODB.Recordset
    Set rs = UnpaidInvoices(OpenDb())
End Sub
